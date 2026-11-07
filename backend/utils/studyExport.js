/**
 * Export av loggboken till Markdown och CSV.
 * Indata: pass med loggrad, block och alster, utvärderingar och mått.
 */

const line = (label, value) => (value ? `- **${label}:** ${String(value).replace(/\n+/g, ' ')}\n` : '');

export function sessionLabel(s) {
  if (s.is_free) return 'Fritt pass';
  return s.week_number ? `Pass ${s.week_number}` : 'Pass';
}

export function logToMarkdown({ title, sessions, reviews, metrics, metricDefs, questions, blockName }) {
  let md = `# Loggbok: ${title}\n\nExporterad ${new Date().toISOString().slice(0, 10)}.\n\n`;
  md += `## Pass\n\n`;
  for (const s of sessions) {
    md += `### ${s.date} · ${sessionLabel(s)}${s.block_name ? ` · ${s.block_name}` : ''}\n\n`;
    md += line('Delmål', s.goal);
    const log = s.log || {};
    md += line('Delmål och mått', log.goal_and_measure);
    md += line('En observation', log.observation);
    md += line('En förändring', log.change);
    md += line('Lera', log.clay_name);
    md += line('Vikt', log.weight_grams ? `${log.weight_grams} g` : '');
    md += line('Serie', log.series_number);
    md += line('I fuktlådan', log.into_damp_box);
    md += line('Utmaningskort', s.challenge_card_name);
    if (s.pieces?.length) md += line('Alster', s.pieces.map((p) => `${p.name} (${p.action_label.toLowerCase()})`).join(', '));
    md += '\n';
  }
  if (reviews.length) {
    md += `## Blockutvärderingar\n\n`;
    for (const r of reviews) {
      md += `### ${blockName(r.plan_block_id)} · ${r.created_at.slice(0, 10)}\n\n`;
      r.answers.forEach((a, i) => {
        if (a) md += `**${questions[i] || `Fråga ${i + 1}`}**\n\n${a}\n\n`;
      });
      if (r.next_goals) md += `**Nästa blocks delmål**\n\n${r.next_goals}\n\n`;
    }
  }
  if (metrics.length) {
    md += `## Mått\n\n| Datum | Block | Mått | Värde |\n| --- | --- | --- | --- |\n`;
    for (const m of metrics) {
      const def = metricDefs.find((d) => d.id === m.metric_id);
      md += `| ${m.measured_at.slice(0, 10)} | ${blockName(m.plan_block_id)} | ${def?.name || m.metric_id} | ${m.value}${def?.unit ? ` ${def.unit}` : ''} |\n`;
    }
  }
  return md;
}

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV med semikolon och BOM så att svenska Excel öppnar den rätt. */
export function logToCsv(sessions) {
  const head = ['Datum', 'Pass', 'Block', 'Fritt', 'Delmål', 'Delmål och mått', 'Observation', 'Förändring',
    'Lera', 'Vikt (g)', 'Serie', 'I fuktlådan', 'Utmaningskort', 'Alster'];
  const rows = sessions.map((s) => {
    const log = s.log || {};
    return [s.date, s.is_free ? '' : s.week_number, s.block_name, s.is_free ? 'ja' : 'nej', s.goal,
      log.goal_and_measure, log.observation, log.change, log.clay_name, log.weight_grams, log.series_number,
      log.into_damp_box, s.challenge_card_name, (s.pieces || []).length];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
