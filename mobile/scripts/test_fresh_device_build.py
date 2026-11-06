"""Offline signing-policy tests. Every profile and bundle is a temporary fixture."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import plistlib
import subprocess
import tempfile
import types
import unittest

MODULE = Path(__file__).with_name('fresh_device_build.py')
if MODULE.exists():
    spec = importlib.util.spec_from_file_location('fresh_device_build', MODULE)
    signing = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(signing)
else:
    signing = types.SimpleNamespace()

NOW = dt.datetime(2026, 11, 6, 12, tzinfo=dt.timezone.utc)
TEAM = 'X2RS69BS48'
APP = 'com.adrian.oracle'
WIDGET = APP + '.widget'


def profile(bundle=APP, age=0, hours=168, **changes):
    value = {
        'TeamIdentifier': [TEAM], 'LocalProvision': True,
        'CreationDate': (NOW - dt.timedelta(seconds=age)).replace(tzinfo=None),
        'ExpirationDate': (NOW + dt.timedelta(hours=hours)).replace(tzinfo=None),
        'ProvisionedDevices': ['PRIVATE-DEVICE'], 'DeveloperCertificates': [b'signer'],
        'Entitlements': {'application-identifier': TEAM + '.' + bundle,
                         'com.apple.developer.team-identifier': TEAM,
                         'get-task-allow': True},
    }
    value.update(changes)
    return value


class SigningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root / 'cache'
        self.cache.mkdir()
        self.calls = []
        self.build_error = False
        self.stale = False
        self.extra = False
        self.bad_signature = False
        self.bad_certificate = False
        self.wrong_signer_team = False
        self.config = {'team': TEAM, 'bundles': {'': APP, 'PlugIns/OracleWidget.appex': WIDGET},
                       'project': 'ios/App/App.xcodeproj', 'scheme': 'App',
                       'configuration': 'Debug', 'app_name': 'App.app',
                       'derived_data_root': 'build/device'}

    def put(self, name, value):
        path = self.cache / name
        path.write_bytes(plistlib.dumps(value))
        return path

    def runner(self, args, **kwargs):
        self.calls.append(args)
        stdout, stderr = b'', b''
        if args[:3] == ['security', 'cms', '-D']:
            stdout = Path(args[-1]).read_bytes()
        elif args[0] == 'xcodebuild':
            if self.build_error:
                # A concurrent replacement must survive restoration.
                self.put('old.mobileprovision', profile(hours=167))
                raise subprocess.CalledProcessError(65, args)
            derived = Path(args[args.index('-derivedDataPath') + 1])
            app = derived / 'Build/Products/Debug-iphoneos/App.app'
            for relative, bundle in self.config['bundles'].items():
                target = app / relative
                target.mkdir(parents=True, exist_ok=True)
                (target / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier': bundle}))
                (target / 'embedded.mobileprovision').write_bytes(plistlib.dumps(
                    profile(bundle, age=86400 if self.stale else 0)))
            if self.extra:
                (app / 'PlugIns/Unexpected.appex').mkdir()
        elif args[0] == 'codesign':
            if '--verify' in args and self.bad_signature:
                raise subprocess.CalledProcessError(1, args)
            if '--entitlements' in args:
                bundle = APP if args[-1].endswith('App.app') else WIDGET
                stdout = plistlib.dumps(profile(bundle)['Entitlements'])
            elif '--verbose=4' in args:
                bundle = APP if args[-1].endswith('App.app') else WIDGET
                team = 'WRONG' if self.wrong_signer_team else TEAM
                stderr = f'Identifier={bundle}\nTeamIdentifier={team}\n'.encode()
            elif '--extract-certificates' in args:
                raise subprocess.CalledProcessError(1, args)
            elif any(arg.startswith('--extract-certificates=') for arg in args):
                prefix = next(arg.split('=', 1)[1] for arg in args if arg.startswith('--extract-certificates='))
                Path(prefix + '0').write_bytes(b'other' if self.bad_certificate else b'signer')
        return subprocess.CompletedProcess(args, 0, stdout, stderr)

    def execute(self):
        return signing.run_build(self.config, [self.cache], self.root, self.root / 'audit',
                                 runner=self.runner, clock=lambda: NOW)

    def test_only_exact_free_development_profiles_are_quarantined(self):
        old = self.put('old.mobileprovision', profile(age=86400))
        widget = self.put('widget.provisionprofile', profile(WIDGET))
        untouched = {
            'other.mobileprovision': profile('com.someone.other'),
            'paid.mobileprovision': profile(LocalProvision=False),
            'distribution.mobileprovision': profile(Entitlements={
                **profile()['Entitlements'], 'get-task-allow': False}),
            'other-team.mobileprovision': profile(TeamIdentifier=['OTHER']),
        }
        for name, value in untouched.items():
            self.put(name, value)
        result = self.execute()
        self.assertEqual(result['outcome'], 'verified')
        self.assertFalse(old.exists())
        self.assertFalse(widget.exists())
        for name in untouched:
            self.assertTrue((self.cache / name).exists())
        audit_dir = next((self.root / 'audit').glob('run-*'))
        self.assertEqual(audit_dir.stat().st_mode & 0o777, 0o700)
        self.assertEqual(len(list((audit_dir / 'profiles').iterdir())), 2)
        command = next(args for args in self.calls if args[0] == 'xcodebuild')
        self.assertIn('-allowProvisioningUpdates', command)
        self.assertEqual(command[-1], 'build')
        self.assertNotEqual(command[command.index('-derivedDataPath') + 1], 'build/device')
        audit = (audit_dir / 'audit.json').read_text()
        self.assertNotIn('PRIVATE-DEVICE', audit)
        self.assertNotIn('signer', audit)
        self.assertEqual(len(json.loads(audit)['profiles']), 2)

    def test_stale_server_profile_fails_and_restores_cache(self):
        old = self.put('old.mobileprovision', profile(age=86400))
        self.stale = True
        with self.assertRaisesRegex(signing.SigningError, 'fresh'):
            self.execute()
        self.assertTrue(old.exists())
        audit = json.loads(next((self.root / 'audit').glob('run-*/audit.json')).read_text())
        self.assertEqual(audit['outcome'], 'failed')

    def test_build_failure_never_overwrites_a_new_cache_file(self):
        old = self.put('old.mobileprovision', profile(age=86400))
        original = old.read_bytes()
        self.build_error = True
        with self.assertRaises(signing.SigningError):
            self.execute()
        self.assertNotEqual(old.read_bytes(), original)
        self.assertEqual(next((self.root / 'audit').glob('run-*/profiles/*')).read_bytes(), original)
        self.assertFalse(any(args[0] == 'codesign' for args in self.calls))

    def test_expiry_requires_six_days_twenty_three_hours(self):
        for hours in (0, 166.99):
            with self.subTest(hours=hours), self.assertRaises(signing.SigningError):
                signing.validate_profile(profile(hours=hours), APP, TEAM, NOW, NOW)
        signing.validate_profile(profile(hours=167), APP, TEAM, NOW, NOW)

    def test_small_clock_skew_is_allowed_but_old_or_future_profiles_fail(self):
        signing.validate_profile(profile(age=60), APP, TEAM, NOW, NOW)
        for age in (301, -301):
            with self.subTest(age=age), self.assertRaises(signing.SigningError):
                signing.validate_profile(profile(age=age), APP, TEAM, NOW, NOW)

    def test_unexpected_extension_is_rejected(self):
        self.extra = True
        with self.assertRaises(signing.SigningError):
            self.execute()

    def test_signature_team_and_certificate_are_checked(self):
        for flag in ('bad_signature', 'bad_certificate', 'wrong_signer_team'):
            with self.subTest(flag=flag):
                setattr(self, flag, True)
                with self.assertRaises(signing.SigningError):
                    self.execute()
                setattr(self, flag, False)

    def test_non_free_or_wrong_scope_embedded_profiles_fail(self):
        variants = [profile(LocalProvision=False), profile('com.adrian.oracle.other'),
                    profile(TeamIdentifier=['OTHER']), profile(ProvisionedDevices=[])]
        for value in variants:
            with self.subTest(value=value.get('LocalProvision')), self.assertRaises(signing.SigningError):
                signing.validate_profile(value, APP, TEAM, NOW, NOW)

    def test_failed_freshness_audit_retains_only_safe_dates_and_scope(self):
        self.stale = True
        with self.assertRaises(signing.SigningError):
            self.execute()
        audit = json.loads(next((self.root / 'audit').glob('run-*/audit.json')).read_text())
        self.assertEqual(audit['profiles'][0]['outcome'], 'rejected')
        self.assertEqual(audit['profiles'][0]['bundle'], APP)
        self.assertIn('expires', audit['profiles'][0])
        self.assertNotIn('PRIVATE-DEVICE', json.dumps(audit))

    def test_failed_build_preserves_existing_legacy_artifact(self):
        destination = self.root / 'build/device/Build/Products/Debug-iphoneos/App.app'
        destination.mkdir(parents=True)
        (destination / 'previous').write_text('keep')
        self.stale = True
        with self.assertRaises(signing.SigningError):
            self.execute()
        self.assertEqual((destination / 'previous').read_text(), 'keep')
        self.stale = False
        self.execute()
        self.assertFalse((destination / 'previous').exists())
        self.assertTrue((destination / 'embedded.mobileprovision').exists())

    def test_profile_symlinks_are_not_moved(self):
        outside = self.root / 'outside'
        outside.write_bytes(plistlib.dumps(profile()))
        link = self.cache / 'link.mobileprovision'
        link.symlink_to(outside)
        self.execute()
        self.assertTrue(link.is_symlink())
        self.assertTrue(outside.exists())

    def test_cache_replacement_during_decode_is_never_moved(self):
        source = self.put('old.mobileprovision', profile())
        original_runner = self.runner
        def replacing_runner(args, **kwargs):
            result = original_runner(args, **kwargs)
            if args[0] == 'security' and args[-1] == str(source):
                source.unlink()
                source.write_bytes(plistlib.dumps(profile('com.someone.other')))
            return result
        with self.assertRaises(signing.SigningError):
            signing.run_build(self.config, [self.cache], self.root, self.root / 'audit',
                              runner=replacing_runner, clock=lambda: NOW)
        self.assertEqual(plistlib.loads(source.read_bytes())['Entitlements']['application-identifier'],
                         TEAM + '.com.someone.other')

    def test_malformed_config_is_a_sanitized_failure(self):
        for value in ([], {'bundles': {}}, {**self.config, 'bundles': {'': {}}}):
            with self.subTest(value=value), self.assertRaises(signing.SigningError):
                signing.validate_config(value)

    def test_invalid_config_fails_before_mutating_cache(self):
        old = self.put('old.mobileprovision', profile())
        self.config['bundles']['../escape.appex'] = APP + '.escape'
        with self.assertRaises(signing.SigningError):
            self.execute()
        self.assertTrue(old.exists())
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()
