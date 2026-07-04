import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NavigationCore from './NavigationCore';

/**
 * Router shell around the one true site bar (NavigationCore). This file only
 * binds the bar to react-router — location for the active underline, navigate
 * for the mobile sheet, Link for internal items. All markup, styling and
 * behavior live in NavigationCore so the static /learn library renders the
 * SAME bar (via NavigationStatic) and the two surfaces can never drift.
 */
const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <NavigationCore
      pathname={location.pathname}
      navigate={navigate}
      LinkComponent={Link}
    />
  );
};

export default Navigation;
