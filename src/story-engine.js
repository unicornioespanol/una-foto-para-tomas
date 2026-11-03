/** Small reference navigation model; renderer and persistence are separate. */
export class StoryEngine {
  constructor(book) {
    this.book = book;
    this.nodes = new Map(book.nodes.map(n => [n.id, n]));
    this.reset();
  }
  reset() {
    this.state = { nodeId: this.book.entry, route: null, ending: null, history: [], completed: false };
  }
  current() {
    const node = this.nodes.get(this.state.nodeId);
    if (!node) throw new Error('Unknown node');
    if (node.variants && !node.variants[this.state.route]) throw new Error('Missing route for variant');
    return { ...node, ...(node.variants?.[this.state.route] ?? {}) };
  }
  go(target, patch = {}) {
    if (!this.nodes.has(target)) throw new Error('Unknown target');
    const { history, ...snapshot } = this.state;
    this.state = { ...snapshot, ...patch, history: [...history, snapshot], nodeId: target, completed: false };
    this.state.completed = Boolean(this.current().terminal);
    return this.current();
  }
  next() {
    const node = this.current();
    if (node.choices) throw new Error('Choice required');
    if (!node.next) return node;
    return this.go(node.next);
  }
  choose(choiceId) {
    const choice = this.current().choices?.find(c => c.id === choiceId);
    if (!choice) throw new Error('Unknown choice');
    const patch = { ...choice.set };
    if ('route' in patch) patch.ending = null;
    return this.go(choice.to, patch);
  }
  back() {
    if (!this.state.history.length) return this.current();
    const history = [...this.state.history];
    const snapshot = history.pop();
    this.state = { ...snapshot, history };
    return this.current();
  }
}
