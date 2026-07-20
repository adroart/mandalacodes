/* Preview surface for the imported card reading, at /preview/card-reading.
   Shows a real card with its real authored text, so the design can be judged on
   true content. Defaults to card 62; /preview/card-reading/7 picks another.
   `?variant=mobile` or `?variant=desktop` forces one side of the breakpoint. */
import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CardReadingData from './CardReadingData';

export const CardReadingPreview: React.FC = () => {
  const { search } = useLocation();
  const { number } = useParams();
  const q = new URLSearchParams(search).get('variant');
  const variant = q === 'mobile' || q === 'desktop' ? q : undefined;
  const parsed = Number(number);
  const cardNumber = Number.isFinite(parsed) && parsed >= 1 && parsed <= 64 ? parsed : 62;

  return <CardReadingData cardNumber={cardNumber} variant={variant} />;
};

export default CardReadingPreview;
