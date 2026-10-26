// lib/ambient/schedule.js
// 先の時刻にイベントを並べておく共通の仕組み（ファイル音源のループと宇宙で使う）

import { audioWait } from '~/lib/audio/context'

// 先の時刻にイベントを並べておく共通の仕組み。
// emit(at) が at の音を予約し、次までの秒数を返す。cursor は呼び出しをまたいで
// 進み続けるので、予約が二重になったり抜けたりしない。
//
// 待ちに setInterval ではなく audioWait を使うのは、このアプリの決まりどおり
// 音声クロックで進めるため（背面タブでも間引かれない）。横着して先読みを
// 伸ばすより、時計そのものを間引かれないものにするほうが確実。
export function scheduleAhead(ctx, startAt, aheadSec, emit) {
  let cursor  = startAt
  let running = true

  const tick = () => {
    const horizon = ctx.currentTime + aheadSec
    while (cursor < horizon) cursor += emit(cursor)
  }
  tick()

  ;(async () => {
    while (running) {
      await audioWait((aheadSec / 4) * 1000)
      if (running) tick()
    }
  })()

  return () => { running = false }
}
