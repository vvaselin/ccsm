<script setup>
import { ref, onUnmounted } from 'vue'

const word = ref("ボタンを押してね")
let prev = null
const isPlaying = ref(false)
const progress = ref(0)
const isResetting = ref(false)
const timelimit = 5000
let mainLoop = null
let startTime = 0
let controller = null

const fetchWord = async () => {
  if (controller) controller.abort()
  controller = new AbortController()

  try {
    const res = await $fetch("http://127.0.0.1:8000/word", { 
      query: { prev },
      signal: controller.signal 
    })
    prev = res.word
    word.value = res.word
  } catch (e) {
    if (e.name === 'AbortError') return
    word.value = "エラー"
  } finally {
    controller = null
  }
}

const start = () => {
  if (isPlaying.value) return
  isPlaying.value = true
  fetchWord()
  startTime = Date.now()

  mainLoop = setInterval(() => {
    const elapsed = Date.now() - startTime
    progress.value = (elapsed / timelimit) * 100

    if (elapsed >= timelimit) {
      fetchWord()
      startTime = Date.now()

      // リセット時: transition を一瞬切ってから戻す
      isResetting.value = true
      progress.value = 0
      requestAnimationFrame(() => {
        isResetting.value = false
      })
    }
  }, 16)
}

const stop = () => {
  isPlaying.value = false
  if (mainLoop) {
    clearInterval(mainLoop)
    mainLoop = null
  }
  if (controller) {
    controller.abort()
    controller = null
  }
  progress.value = 0
}

const toggle = () => {
  isPlaying.value ? stop() : start()
}

onUnmounted(() => stop())
</script>

<template>
  <div class="p-4 max-w-md mx-auto">
    <div class="flex justify-center">
      <button
        @click="toggle"
        class="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-transform active:scale-90"
        :class="isPlaying ? 'bg-red-500' : 'bg-blue-500'"
      >
        {{ isPlaying ? '■' : '▶' }}
      </button>
    </div>

    <UCard class="mt-4 text-center">
      <!-- 単語表示 -->
      <div class="text-4xl font-bold h-32 flex items-center justify-center">
        {{ word }}
      </div>

      <!-- 進捗バー -->
      <div class="mt-4 px-2">
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-primary rounded-full"
            :style="{
              width: progress + '%',
              transition: isResetting ? 'none' : 'width 0.1s linear'
            }"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>