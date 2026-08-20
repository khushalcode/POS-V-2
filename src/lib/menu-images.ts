// Returns an emoji representation of a menu item based on its name.
// Used as a fallback when no real image is uploaded.

export function getItemEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('chicken') || n.includes('mutton')) return '🍗'
  if (n.includes('fish')) return '🐟'
  if (n.includes('paneer') || n.includes('tikka')) return '🧀'
  if (n.includes('biryani') || n.includes('rice')) return '🍚'
  if (n.includes('naan') || n.includes('roti') || n.includes('paratha') || n.includes('bread')) return '🍞'
  if (n.includes('chai') || n.includes('tea') || n.includes('coffee')) return '☕'
  if (n.includes('lassi') || n.includes('juice') || n.includes('soda') || n.includes('water')) return '🥤'
  if (n.includes('ice cream') || n.includes('brownie') || n.includes('dessert')) return '🍨'
  if (n.includes('gulab') || n.includes('rasmalai') || n.includes('jamun')) return '🍮'
  if (n.includes('dal')) return '🍲'
  if (n.includes('spring') || n.includes('fingers') || n.includes('crispy') || n.includes('corn')) return '🍟'
  if (n.includes('pasta') || n.includes('noodle')) return '🍝'
  if (n.includes('pizza')) return '🍕'
  if (n.includes('burger') || n.includes('sandwich')) return '🍔'
  if (n.includes('salad')) return '🥗'
  if (n.includes('soup')) return '🍜'
  if (n.includes('egg') || n.includes('omelette')) return '🍳'
  if (n.includes('dosa') || n.includes('idli') || n.includes('uttapam')) return '🥞'
  if (n.includes('samosa') || n.includes('kachori')) return '🥟'
  if (n.includes('cake') || n.includes('pastry')) return '🍰'
  if (n.includes('cookie') || n.includes('biscuit')) return '🍪'
  if (n.includes('chocolate')) return '🍫'
  if (n.includes('fruit')) return '🍎'
  return '🍽️'
}
