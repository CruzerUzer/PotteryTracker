import { describe, it, expect } from 'vitest';
import { seriesSuggestion } from '../components/study/StudySession';
import { parseMarkdown } from '../components/study/Markdown';

describe('seriesSuggestion', () => {
  it('hoppar över centreringsklumpar och tar serien', () => {
    expect(seriesSuggestion('Centrera 10 klumpar à 1 kg, skär av. Sedan 5 cylindrar à 500 g; skär itu alla.'))
      .toEqual({ count: 5, name: 'Cylinder', weight: 500 });
  });

  it('tar cylindrarna i första passet, inte de olika klumparna', () => {
    expect(seriesSuggestion('Centrera 6 olika klumpar à 1 kg. Skär loss varje klump när den är centrerad och ta nästa. Sedan 4 cylindrar à 500 g; skär itu alla.'))
      .toEqual({ count: 4, name: 'Cylinder', weight: 500 });
  });

  it('läser kilo och intervall', () => {
    expect(seriesSuggestion('Tallrikar: 6 à 1–1,3 kg')).toBeNull();
    expect(seriesSuggestion('Tekannor: 3 kroppar à 1,2–1,4 kg, 8 pipar')).toEqual({ count: 3, name: 'Tekanna', weight: 1200 });
  });

  it('returnerar null utan serie', () => {
    expect(seriesSuggestion('Fri form.')).toBeNull();
  });
});

describe('parseMarkdown', () => {
  it('känner igen rubriker, listor och tabeller', () => {
    const blocks = parseMarkdown('# Titel\n\nText här.\n\n- ett\n- två\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n');
    expect(blocks.map((b) => b.type)).toEqual(['h', 'p', 'ul', 'table']);
    expect(blocks[3].rows).toEqual([['1', '2']]);
  });
});
