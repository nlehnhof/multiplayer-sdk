export interface Question {
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

/** Hardcoded question bank for the trivia example (MVP: no question editor/authoring UI). */
export const questions: Question[] = [
  {
    prompt: 'What is the capital of France?',
    choices: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    correctIndex: 2,
  },
  {
    prompt: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctIndex: 1,
  },
  {
    prompt: 'How many continents are there on Earth?',
    choices: ['5', '6', '7', '8'],
    correctIndex: 2,
  },
  {
    prompt: 'Who wrote the play "Romeo and Juliet"?',
    choices: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'],
    correctIndex: 1,
  },
  {
    prompt: 'What is the chemical symbol for gold?',
    choices: ['Go', 'Gd', 'Au', 'Ag'],
    correctIndex: 2,
  },
];
