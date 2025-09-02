import fs from 'fs'
import { DOMParser } from 'xmldom'

// 讀取你的 world.svg
const svgString = fs.readFileSync('./src/assets/world.svg', 'utf-8')
const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')

const paths = doc.getElementsByTagName('path')
const mapPaths = {}

for (let i = 0; i < paths.length; i++) {
    const el = paths.item(i)
    const id = el.getAttribute('id')
    const d = el.getAttribute('d')
    if (id && d) {
        mapPaths[id] = d
    }
}

const result = {
    viewBox: '0 0 1000 600', // 你可以直接從 <svg viewBox> 取
    mapPaths,
}

fs.writeFileSync('./src/assets/mapPaths.json', JSON.stringify(result, null, 2))
console.log('✅ mapPaths.json generated!')
