// 3-night progression. Pure: the client owns menus/screens, this owns the rules of "what comes next".
export const LAST_NIGHT = 3;

export class Campaign {
  constructor() {
    this.night = 1; // night to play next
    this.total = 0; // sum of scores of nights WON
    this.finished = false; // true after winning the last night (Dawn screen)
    this.results = []; // { night, score } for won nights
  }

  /** Record a finished Game (state won|lost). Returns 'next' | 'retry' | 'dawn'. */
  record(game) {
    if (game.state === 'playing') throw new Error('night not finished');
    if (game.state === 'lost') return 'retry'; // same night again; total unchanged
    this.total += game.score;
    this.results.push({ night: game.night, score: game.score });
    if (game.night >= LAST_NIGHT) {
      this.finished = true;
      return 'dawn';
    }
    this.night = game.night + 1;
    return 'next';
  }

  reset() {
    this.night = 1;
    this.total = 0;
    this.finished = false;
    this.results = [];
  }
}
