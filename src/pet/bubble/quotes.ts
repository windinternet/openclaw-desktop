import type { PetQuote } from '../../lib/pet-types'

export const QUOTES: PetQuote[] = [
  { text: '今天也要加油哦！', emoji: '💪', weight: 1 },
  { text: '有什么我可以帮忙的吗？', emoji: '❓', weight: 1 },
  { text: '嗝～刚刚吃了个 bug', emoji: '🪲', weight: 0.3 },
  { text: 'AI 正在努力思考中...', emoji: '🤔', weight: 1 },
  { text: '你怎么还不来摸我？', emoji: '😿', weight: 0.5 },
  { text: '看！你有个新消息！', emoji: '📧', weight: 0.8 },
  { text: '好无聊啊，来玩吧～', emoji: '🎮', weight: 0.4 },
  { text: '一切都正常运转中！', emoji: '✅', weight: 1 },
  { text: '你的代码写得真棒', emoji: '🌟', weight: 0.5 },
  { text: '又处理了一条消息！', emoji: '⚡', weight: 0.6 },
  { text: '喵～', emoji: '🐱', weight: 0.7 },
]

export function getRandomQuote(): PetQuote {
  const totalWeight = QUOTES.reduce((sum, q) => sum + q.weight, 0)
  let random = Math.random() * totalWeight
  for (const quote of QUOTES) {
    random -= quote.weight
    if (random <= 0) return quote
  }
  return QUOTES[0]
}
