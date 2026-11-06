#!/usr/bin/env python3
"""Build with fresh Personal Team profiles, verify, then expose the device artifact.

Only Apple-supplied security/codesign/xcodebuild commands and Python's standard
library are used. Nothing installs an app or changes certificates/registrations.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile

UTC = dt.timezone.utc
MIN_REMAINING = dt.timedelta(days=6, hours=23)
CLOCK_SKEW = dt.timedelta(minutes=5)


class SigningError(Exception):
    """A sanitized error safe to display without command/profile contents."""


def utc(value):
    if not isinstance(value, dt.datetime):
        raise SigningError('Missing profile dates.')
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def profile_scope(value, bundle, team):
    entitlements = value.get('Entitlements', {})
    if not isinstance(entitlements, dict):
        return False
    return (value.get('TeamIdentifier') == [team]
            and entitlements.get('com.apple.developer.team-identifier') == team
            and entitlements.get('application-identifier') == team + '.' + bundle
            and entitlements.get('get-task-allow') is True
            and value.get('LocalProvision') is True
            and bool(value.get('ProvisionedDevices'))
            and not value.get('ProvisionsAllDevices'))


def validate_profile(value, bundle, team, started, now):
    if not profile_scope(value, bundle, team):
        raise SigningError('Embedded profile is not the exact free development scope.')
    created, expires = utc(value.get('CreationDate')), utc(value.get('ExpirationDate'))
    if created < started - CLOCK_SKEW or created > now + CLOCK_SKEW:
        raise SigningError('A fresh profile was not issued for this build.')
    if expires - now < MIN_REMAINING:
        raise SigningError('Profile has less than 6 days 23 hours remaining.')
    if expires <= created or expires - created > dt.timedelta(days=7) + CLOCK_SKEW:
        raise SigningError('Profile is outside the free seven-day signing policy.')
    return {'bundle': bundle, 'team': team, 'created': created.isoformat(),
            'expires': expires.isoformat(), 'outcome': 'verified'}


def command(args, runner, **kwargs):
    try:
        return runner(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    except (OSError, subprocess.SubprocessError):
        raise SigningError('Apple signing/build command failed; no artifact was approved.') from None


def decode(path, runner):
    result = command(['security', 'cms', '-D', '-i', str(path)], runner)
    try:
        value = plistlib.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, plistlib.InvalidFileException):
        raise SigningError('Could not decode provisioning metadata.') from None


def validate_config(config):
    required = {'team', 'bundles', 'project', 'scheme', 'configuration', 'app_name', 'derived_data_root'}
    if not isinstance(config, dict) or set(config) != required or not all(isinstance(config[key], str) and config[key]
                                         for key in required - {'bundles'}):
        raise SigningError('Invalid build configuration.')
    bundles = config['bundles']
    if (not isinstance(bundles, dict) or '' not in bundles
            or not all(isinstance(value, str) for value in bundles.values())
            or len(set(bundles.values())) != len(bundles)):
        raise SigningError('Configure the app and every extension exactly once.')
    for relative, bundle in bundles.items():
        path = Path(relative)
        if (not isinstance(bundle, str) or not bundle or '*' in bundle or path.is_absolute()
                or '..' in path.parts or (relative and path.suffix != '.appex')):
            raise SigningError('Invalid bundle scope or extension path.')
    if Path(config['app_name']).name != config['app_name'] or not config['app_name'].endswith('.app'):
        raise SigningError('Invalid app name.')


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as stream:
        os.chmod(temporary, 0o600)
        json.dump(value, stream, indent=2)
        stream.write('\n')
    os.replace(temporary, path)


def restore_profiles(moved):
    outcomes = []
    for source, backup in reversed(moved):
        if not backup.exists():
            continue
        try:
            # link is atomic and refuses to overwrite a concurrent replacement.
            os.link(backup, source, follow_symlinks=False)
            backup.unlink()
            outcomes.append('restored')
        except FileExistsError:
            outcomes.append('retained-conflict')
        except OSError:
            outcomes.append('retained-for-recovery')
    return outcomes


def verify_bundle(path, bundle, team, started, now, runner, private_dir, records):
    try:
        info = plistlib.loads((path / 'Info.plist').read_bytes())
    except (OSError, ValueError, plistlib.InvalidFileException):
        raise SigningError('Built bundle metadata is missing or invalid.') from None
    if info.get('CFBundleIdentifier') != bundle:
        raise SigningError('Built bundle identifier differs from the configured scope.')
    profile = decode(path / 'embedded.mobileprovision', runner)
    record = {'bundle': bundle, 'team': team, 'outcome': 'rejected'}
    for source, target in [('CreationDate', 'created'), ('ExpirationDate', 'expires')]:
        if isinstance(profile.get(source), dt.datetime):
            record[target] = utc(profile[source]).isoformat()
    records.append(record)
    proof = validate_profile(profile, bundle, team, started, now)
    command(['codesign', '--verify', '--strict', str(path)], runner)
    signed = command(['codesign', '-d', '--verbose=4', str(path)], runner)
    metadata = dict(line.split('=', 1) for line in signed.stderr.decode(errors='replace').splitlines()
                    if '=' in line)
    if metadata.get('TeamIdentifier') != team or metadata.get('Identifier') != bundle:
        raise SigningError('Actual signature team or bundle identifier is incorrect.')
    signed = command(['codesign', '-d', '--entitlements', ':-', str(path)], runner)
    try:
        entitlements = plistlib.loads(signed.stdout)
    except (ValueError, plistlib.InvalidFileException):
        raise SigningError('Cannot inspect actual signed entitlements.') from None
    if any(entitlements.get(key) != value for key, value in {
        'application-identifier': team + '.' + bundle,
        'com.apple.developer.team-identifier': team, 'get-task-allow': True,
    }.items()):
        raise SigningError('Actual signed entitlements differ from the development scope.')
    with tempfile.TemporaryDirectory(prefix='certificate-', dir=private_dir) as directory:
        prefix = str(Path(directory) / 'signer')
        command(['codesign', '-d', '--extract-certificates', prefix, str(path)], runner)
        try:
            certificate = Path(prefix + '0').read_bytes()
        except OSError:
            raise SigningError('Cannot inspect the actual signature certificate.') from None
        if certificate not in profile.get('DeveloperCertificates', []):
            raise SigningError('Actual signer certificate is absent from the embedded profile.')
    record.update(proof)
    return proof


def run_build(config, cache_dirs, work_dir, audit_root, runner=subprocess.run,
              clock=lambda: dt.datetime.now(UTC)):
    validate_config(config)
    work_dir, audit_root = Path(work_dir).resolve(), Path(audit_root).resolve()
    audit_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(audit_root, 0o700)
    with (audit_root / 'scope.lock').open('a') as lock:
        os.chmod(audit_root / 'scope.lock', 0o600)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SigningError('Another build owns this signing scope.') from None
        run_dir = Path(tempfile.mkdtemp(prefix='run-', dir=audit_root))
        backups = run_dir / 'profiles'
        backups.mkdir(mode=0o700)
        started = utc(clock())
        audit = {'started': started.isoformat(), 'team': config['team'],
                 'outcome': 'started', 'profiles': []}
        moved = []
        recovery = []
        write_json(run_dir / 'audit.json', audit)
        try:
            for directory in cache_dirs:
                directory = Path(directory)
                if not directory.exists():
                    continue
                if directory.is_symlink():
                    raise SigningError('A provisioning cache directory is a symlink.')
                for source in sorted(directory.iterdir()):
                    if source.suffix not in ('.mobileprovision', '.provisionprofile') or source.is_symlink() or not source.is_file():
                        continue
                    try:
                        before = source.stat(follow_symlinks=False)
                        value = decode(source, runner)
                    except SigningError:
                        # Unknown profiles are never eligible for cache mutation.
                        continue
                    if not any(profile_scope(value, bundle, config['team']) for bundle in config['bundles'].values()):
                        continue
                    after = source.stat(follow_symlinks=False)
                    identity = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
                    if any(getattr(before, key) != getattr(after, key) for key in identity):
                        raise SigningError('Provisioning cache changed during inspection; retry safely.')
                    backup = backups / str(len(moved))
                    recovery.append({'source': str(source), 'backup': str(backup)})
                    write_json(run_dir / 'recovery.json', recovery)
                    moved.append((source, backup))
                    os.rename(source, backup)
            derived_root = (work_dir / config['derived_data_root']).resolve()
            derived_root.mkdir(parents=True, exist_ok=True)
            derived = Path(tempfile.mkdtemp(prefix='fresh-', dir=derived_root))
            env = dict(os.environ, DEVELOPER_DIR='/Applications/Xcode.app/Contents/Developer')
            started = utc(clock())
            audit['started'] = started.isoformat()
            write_json(run_dir / 'audit.json', audit)
            # Build output is intentionally suppressed: Xcode can print device/account identifiers.
            command(['xcodebuild', '-project', config['project'], '-scheme', config['scheme'],
                     '-configuration', config['configuration'], '-destination', 'generic/platform=iOS',
                     '-derivedDataPath', str(derived), '-allowProvisioningUpdates', 'build'],
                    runner, cwd=work_dir, env=env)
            app = derived / 'Build/Products' / (config['configuration'] + '-iphoneos') / config['app_name']
            discovered = {str(path.relative_to(app)) for path in app.rglob('*.appex')}
            if discovered != set(config['bundles']) - {''}:
                raise SigningError('Built extensions differ from the exact configured scope.')
            now = utc(clock())
            for relative, bundle in config['bundles'].items():
                verify_bundle(app / relative, bundle, config['team'], started, now,
                              runner, run_dir, audit['profiles'])
            # Include the containing app's resource seal and all nested signatures.
            command(['codesign', '--verify', '--deep', '--strict', str(app)], runner)
            # Keep the established output path; only a completely verified app reaches it.
            destination = derived_root / 'Build/Products' / (config['configuration'] + '-iphoneos') / config['app_name']
            destination.parent.mkdir(parents=True, exist_ok=True)
            previous = derived / 'previous-app'
            if destination.exists():
                os.rename(destination, previous)
            try:
                os.rename(app, destination)
            except BaseException:
                if previous.exists():
                    os.rename(previous, destination)
                raise
            audit['outcome'] = 'verified'
            audit['finished'] = utc(clock()).isoformat()
            write_json(run_dir / 'audit.json', audit)
            return audit
        except BaseException as error:
            audit['outcome'] = 'failed'
            audit['finished'] = utc(clock()).isoformat()
            audit['cache_outcome'] = restore_profiles(moved)
            write_json(run_dir / 'audit.json', audit)
            if isinstance(error, SigningError):
                raise
            raise SigningError('Build interrupted or failed; previous cache restored where safe. Check private audit/recovery files.') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=Path(__file__).with_name('oracle-device-signing.json'))
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text())
        validate_config(config)
        scope = hashlib.sha256((config['team'] + '\n' + '\n'.join(sorted(config['bundles'].values()))).encode()).hexdigest()[:16]
        audit_root = Path.home() / 'Library/Application Support/FreshDeviceSigning' / scope
        cache_dirs = [Path.home() / 'Library/MobileDevice/Provisioning Profiles',
                      Path.home() / 'Library/Developer/Xcode/UserData/Provisioning Profiles']
        signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
        result = run_build(config, cache_dirs, Path.cwd(), audit_root)
        print(json.dumps(result, indent=2))
        print('Verified build only. No app installed. Private audit: ' + str(audit_root))
        return 0
    except (SigningError, OSError, ValueError) as error:
        message = str(error) if isinstance(error, SigningError) else 'Could not read signing configuration or create private build state.'
        print('Fresh signing FAILED: ' + message, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
