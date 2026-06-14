export class LineChart {
  constructor(canvas, { color = "#5eead4", emptyLabel = "", label = "" } = {}) {
    this.canvas = canvas
    this.context = canvas.getContext("2d")
    this.color = color
    this.emptyLabel = emptyLabel
    this.label = label
  }

  render(values) {
    const context = this.context
    const width = this.canvas.width
    const height = this.canvas.height
    const padding = 36

    context.clearRect(0, 0, width, height)
    context.fillStyle = themeColor("--chart-surface", "rgba(15, 23, 42, 0.75)")
    context.fillRect(0, 0, width, height)

    context.strokeStyle = themeColor("--chart-grid", "rgba(148, 163, 184, 0.18)")
    context.lineWidth = 1
    for (let index = 0; index < 5; index += 1) {
      const y = padding + ((height - padding * 2) / 4) * index
      context.beginPath()
      context.moveTo(padding, y)
      context.lineTo(width - padding, y)
      context.stroke()
    }

    if (values.length === 0) {
      if (!this.emptyLabel) return

      context.fillStyle = themeColor("--chart-empty", "rgba(203, 213, 225, 0.7)")
      context.font = "20px sans-serif"
      context.fillText(this.emptyLabel, padding, height / 2)
      return
    }

    const min = Math.min(...values, 0)
    const max = Math.max(...values, 10)
    const range = Math.max(max - min, 1)

    const points = values.map((value, index) => {
      const x = values.length === 1 ? width / 2 : padding + ((width - padding * 2) * index) / (values.length - 1)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return [x, y, value]
    })

    context.strokeStyle = this.color
    context.lineWidth = 4
    context.lineJoin = "round"
    context.lineCap = "round"
    context.beginPath()
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()

    points.forEach(([x, y]) => {
      context.fillStyle = themeColor("--chart-point-fill", "#020617")
      context.beginPath()
      context.arc(x, y, 7, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = this.color
      context.lineWidth = 3
      context.stroke()
    })

    context.fillStyle = themeColor("--chart-label", "rgba(226, 232, 240, 0.82)")
    context.font = "16px sans-serif"
    context.fillText(`${this.label}: ${values.at(-1)}`, padding, padding - 10)
  }
}

function themeColor(name, fallback) {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
