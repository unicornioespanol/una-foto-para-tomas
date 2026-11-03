import { StoryEngine } from './story-engine.js';
export const STORAGE_KEY = 'book:una-foto-para-tomas:v1';
export const phases = ['pre-family', 'pre-details', 'pre-prediction', 'pre-ofrenda', 'reading', 'post-order', 'post-evidence', 'post-album', 'complete'];
export function initialState(book) {
  return { schemaVersion: 1, bookId: book.bookId, contentVersion: book.contentVersion,
    phase: 'pre-family', ...new StoryEngine(book).state, prediction: null,
    preAnswers: {}, postAnswers: {}, album: null, lastRoute: null, lastEnding: null,
    settings: { textVisible: true, rate: .9, voiceURI: null }, bookCompleted: false };
}
function sameSnapshot(a, b) {
  return ['nodeId', 'route', 'ending', 'completed'].every(k => a[k] === b[k]);
}
export function validateState(value, book) {
  if (!value || value.schemaVersion !== 1 || value.bookId !== book.bookId || value.contentVersion !== book.contentVersion || !phases.includes(value.phase)) throw new Error('Version');
  if (!Array.isArray(value.history) || value.history.length > 8) throw new Error('History');
  const engine = new StoryEngine(book);
  for (let i = 0; i < value.history.length; i++) {
    if (!sameSnapshot(value.history[i], engine.state)) throw new Error('Unreachable snapshot');
    const next = value.history[i + 1] ?? value;
    const node = engine.current();
    if (node.choices) {
      const choice = node.choices.find(c => c.to === next.nodeId);
      if (!choice) throw new Error('Invalid choice');
      engine.choose(choice.id);
    } else {
      if (node.next !== next.nodeId) throw new Error('Invalid transition');
      engine.next();
    }
  }
  if (!sameSnapshot(engine.state, value)) throw new Error('Invalid current state');
  if ((value.phase.startsWith('post-') || value.phase === 'complete') && !engine.current().terminal) throw new Error('Premature activities');
  if (!value.settings || typeof value.settings.textVisible !== 'boolean' || ![.8,.9,1].includes(value.settings.rate)) throw new Error('Settings');
  if (value.settings.voiceURI !== null && typeof value.settings.voiceURI !== 'string') throw new Error('Voice');
  if (![null, 'Serio', 'Divertido', 'No sé'].includes(value.prediction)) throw new Error('Prediction');
  for (const key of ['preAnswers','postAnswers']) if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error('Answers');
  const p = value.preAnswers;
  if(p.familyOrder!==undefined&&(!Array.isArray(p.familyOrder)||p.familyOrder.length!==3||new Set(p.familyOrder).size!==3||!p.familyOrder.every(id=>['lucia','abuela','tomas'].includes(id))))throw new Error('Family order');
  if (p.familyPrompt !== undefined && ![0,1,2].includes(p.familyPrompt)) throw new Error('Family prompt');
  for (const key of ['family','hotspots','ofrenda']) if (p[key] !== undefined && (!Array.isArray(p[key]) || !p[key].every(x=>typeof x === 'string'))) throw new Error('Pre-reading');
  if (value.lastRoute !== null && !book.routeValues.includes(value.lastRoute)) throw new Error('Route');
  if (value.lastEnding !== null && !book.endingValues.includes(value.lastEnding)) throw new Error('Ending');
  const order = value.postAnswers.order;
  const allowed = value.route === 'photo' ? ['wind','cat-photo','ball','cat-memory'] : ['wind','drawing-start','guitar','drawing-done'];
  if (order && (!Array.isArray(order) || order.length !== 4 || new Set(order).size !== 4 || !order.every(id=>allowed.includes(id)))) throw new Error('Order');
  if (value.postAnswers.interpretation && !['Serio','Divertido','Serio y divertido','No sé'].includes(value.postAnswers.interpretation)) throw new Error('Interpretation');
  if (value.album && (!['jardin','cocina','salon'].includes(value.album.place) || !['gato','guitarra','pelota'].includes(value.album.object) || !['cantar','jugar con el gato','jugar con la pelota'].includes(value.album.activity))) throw new Error('Album');
  return { ...initialState(book), ...value, ...engine.state };
}
export function loadProgress(book, storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { state: raw ? validateState(JSON.parse(raw), book) : initialState(book), exists: Boolean(raw), message: '' };
  } catch (error) {
    return { state: initialState(book), exists: false, message: error.name === 'SecurityError' ? 'Puedes leer. El progreso se guardará solo en esta pestaña.' : 'No pudimos recuperar el progreso. Puedes empezar de nuevo.' };
  }
}
