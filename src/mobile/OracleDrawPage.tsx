import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { useJournal } from '../../lib/oracle/journal';
import OracleDrawDialog from '../../components/oracle/entry/OracleDrawDialog';
import '../../components/oracle/entry/OracleEntry.scoped.css';
export default function OracleDrawPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { isDarkMode } = useDarkMode();
  const { record } = useJournal();
  const returnTo = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') && state.returnTo !== '/draw' ? state.returnTo : '/universal-language';
  const close = useCallback(() => navigate(returnTo, {replace:true}), [navigate, returnTo]);
  return <div className="oe-root"><OracleDrawDialog theme={isDarkMode ? 'dark' : 'light'} onClose={close} onOpen={(number, cast) => {
    const card = CARD_BY_NUMBER.get(number);
    if (card) record(number, card.card_name);
    navigate(`/universal-language/${number}`, {replace:true, state:{entrance:true, oracleCast:cast}});
  }} /></div>;
}
