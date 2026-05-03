// composables/useWordPicker.js
// word_picker.py の JS 移植版

const SAME_CATEGORY_PROB = 0.4
const HISTORY_SIZE       = 10
const USED_MAX           = 200

let _vocabCache = null

async function loadVocab() {
  if (_vocabCache) return _vocabCache
  const res = await fetch('/vocab.json')
  if (!res.ok) throw new Error('vocab.json の読み込みに失敗しました')
  _vocabCache = await res.json()
  return _vocabCache
}

function createSession() {
  return { history: [], used: new Set() }
}

function sessionAdd(session, word) {
  session.history.push(word)
  if (session.history.length > HISTORY_SIZE) session.history.shift()
  session.used.add(word)
  if (session.used.size >= USED_MAX) session.used = new Set()
}

function pickFrom(candidates, session) {
  const notRecent = candidates.filter(w => !session.history.includes(w))
  const notUsed   = notRecent.filter(w => !session.used.has(w))
  if (notUsed.length > 0)   return notUsed[Math.floor(Math.random() * notUsed.length)]
  if (notRecent.length > 0) return notRecent[Math.floor(Math.random() * notRecent.length)]
  return null
}

function pickFromCategory(categoryMap, cat, session) {
  return pickFrom(categoryMap[cat] ?? [], session)
}

function pickFromOtherCategory(categoryMap, currentCat, session) {
  const others = Object.keys(categoryMap).filter(c => c !== currentCat)
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]]
  }
  for (const cat of others) {
    const w = pickFromCategory(categoryMap, cat, session)
    if (w) return w
  }
  return null
}

export function useWordPicker() {
  const session = createSession()

  async function pickNext(prev = null) {
    const { categoryMap, wordToCategory } = await loadVocab()
    const allWords = Object.values(categoryMap).flat()

    let result = null

    if (prev === null) {
      result = pickFrom(allWords, session)
    } else {
      const currentCat = wordToCategory[prev] ?? null
      if (currentCat && Math.random() < SAME_CATEGORY_PROB) {
        result = pickFromCategory(categoryMap, currentCat, session)
        if (!result) result = pickFromOtherCategory(categoryMap, currentCat, session)
      } else {
        result = pickFromOtherCategory(categoryMap, currentCat, session)
      }
    }

    if (!result) {
      session.used = new Set()
      result = pickFrom(allWords, session) ?? allWords[Math.floor(Math.random() * allWords.length)]
    }

    sessionAdd(session, result)
    return result
  }

  return { pickNext }
}