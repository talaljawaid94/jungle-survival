const KEY = 'jungle-survival-save-v1';
export const hasSave = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
export const writeSave = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } };
export const readSave = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
export const clearSave = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
