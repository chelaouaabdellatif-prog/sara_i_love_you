import { newId } from './utils.js';

// Ajout rapide : on colle plusieurs questions d'un coup.
//
//   Module: Pharmacologie          (optionnel, s'applique aux questions suivantes)
//   L'amoxicilline est une :
//   A) Macrolide
//   *B) Bêta-lactamine              (étoile au début ou à la fin = bonne réponse)
//   C) Aminoside
//   > Explication (optionnelle)
//
// Les questions sont séparées par une ligne vide.
const CHOICE_RE = /^(\*)?\s*([A-Ha-h])\s*[).:-]\s*(.+?)\s*(\*)?$/;
const EXPLANATION_RE = /^(?:>|explication\s*:)\s*(.*)$/i;
const MODULE_RE = /^module\s*:\s*(.+)$/i;
const NUMBER_RE = /^(?:q\s*\d*\s*[:.)-]|\d+\s*[).:-])\s*/i;

export function parseBulk(text, defaultModule) {
  let module = defaultModule?.trim() || 'Général';
  const questions = [];
  const errors = [];

  text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .forEach((block, blockIndex) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const q = { text: [], choices: [], correct: [], explanation: [] };
      let inExplanation = false;

      for (const line of lines) {
        const mod = line.match(MODULE_RE);
        if (mod) {
          module = mod[1].trim();
          continue;
        }
        const expl = line.match(EXPLANATION_RE);
        if (expl) {
          inExplanation = true;
          if (expl[1]) q.explanation.push(expl[1]);
          continue;
        }
        if (inExplanation) {
          q.explanation.push(line);
          continue;
        }
        const choice = q.text.length ? line.match(CHOICE_RE) : null;
        if (choice) {
          if (choice[1] || choice[4]) q.correct.push(q.choices.length);
          q.choices.push(choice[3]);
          continue;
        }
        if (q.choices.length) {
          q.choices[q.choices.length - 1] += ` ${line}`;
          continue;
        }
        q.text.push(q.text.length ? line : line.replace(NUMBER_RE, ''));
      }

      if (!q.text.length && !q.choices.length) return; // bloc "Module:" seul
      const label = `Question ${blockIndex + 1} (« ${q.text.join(' ').slice(0, 40)}… »)`;
      if (q.choices.length < 2) return errors.push(`${label} : il faut au moins 2 réponses (A), B)…).`);
      if (!q.correct.length) return errors.push(`${label} : aucune bonne réponse marquée avec *.`);

      questions.push({
        id: newId(),
        module,
        text: q.text.join(' '),
        choices: q.choices,
        correct: q.correct,
        explanation: q.explanation.join(' '),
      });
    });

  return { questions, errors };
}
