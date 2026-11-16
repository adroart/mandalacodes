import React, { useState } from 'react';
import SignInModal, { type SignInContext } from './SignInModal';

/**
 * Wraps any trigger element so clicking it opens the self-owned sign-in modal.
 */
const SignInTrigger: React.FC<{
  children: React.ReactElement;
  onSignedIn?: () => void;
  context?: SignInContext;
}> = ({ children, onSignedIn, context }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {React.cloneElement(children, { onClick: () => setOpen(true) })}
      {open && <SignInModal context={context} onClose={() => setOpen(false)} onSignedIn={onSignedIn} />}
    </>
  );
};

export default SignInTrigger;
