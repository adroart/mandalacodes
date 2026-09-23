import { expect, it } from 'vitest';
import { artDesignHref, artInstanceHref } from '../../lib/atlas/artSite';
import { FULL_ARCHIVE } from '../../data/mockData';
import { ulPieceForCard } from '../../utils/universalLanguage';
it('maps every card by its explicit stable identity, preserving catalogue titles', () => {
  for (let n=1;n<=64;n++) {
    const art = ulPieceForCard(n)!;
    expect(art.cardNumber).toBe(n);
    expect(artDesignHref(art.id,n)).toBe(`https://adrianrasmussen.com/creations/${art.id}?from=mandalacodes&card=${n}`);
  }
  expect(ulPieceForCard(1)?.id).toBe('UL-122');
  for (const n of [51,58,61]) expect(ulPieceForCard(n)?.title).toBe(FULL_ARCHIVE.find(a=>a.cardNumber===n)?.title);
});
it('never forwards mismatched card context or turns a catalogue ID into an instance', () => {
  expect(artDesignHref('UL-122',64)).toBe('https://adrianrasmussen.com/creations/UL-122');
  expect(artInstanceHref('UL-122')).toBeNull();
  expect(artInstanceHref('UL-122','UL-122')).toBeNull();
  expect(artInstanceHref('UL-122','AR-TEST-001')).toBe('https://adrianrasmussen.com/works/UL-122?instance=AR-TEST-001');
});

it('preserves only canonical public instance codes through the Atlas adapter', async () => {
  const { adaptCollectorFieldState } = await import('../../functions/api/atlas/_collectorField');
  const result=adaptCollectorFieldState({schemaVersion:3,lights:[{artworkId:'UL-122',series:'Universal Language',identity:[
    {status:'registered',editionLabel:'Edition 1',publicCode:'AR-TEST-001',city:null,ownershipCode:'PRIVATE'},
    {status:'private',editionLabel:'Edition 2',publicCode:'AR-TEST-002',city:null},
    {status:'unregistered',publicCode:'AR-TEST-003'},
  ]}]});
  expect(result?.pieces.map(p=>[p.editionNumber,p.publicCode])).toEqual([[1,'AR-TEST-001'],[2,'AR-TEST-002']]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
