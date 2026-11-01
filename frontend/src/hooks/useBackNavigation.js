import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Bakåt dit användaren kom ifrån. Saknas historik i appen (t.ex. öppnad via
 * länk eller ny flik) går vi till fallback i stället för att lämna appen.
 */
export function useBackNavigation(fallback = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

export default useBackNavigation;
