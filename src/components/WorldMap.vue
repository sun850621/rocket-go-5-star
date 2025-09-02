<template>
    <div ref="mapContainer" class="map-container">
        <svg
            ref="svgEl"
            xmlns="http://www.w3.org/2000/svg"
            :viewBox="svgViewBox"
            class="world-map"
        >
            <g ref="gEl">
                <path
                    v-for="(d, id) in mapPaths"
                    :key="id"
                    :id="id"
                    :d="d"
                    :class="['country', { active: id === modelValueUpper }]"
                    @click.stop="onCountryClick(id)"
                    @mouseenter="showTooltip($event, id)"
                    @mousemove="moveTooltip($event)"
                    @mouseleave="hideTooltip"
                />
            </g>
        </svg>

        <!-- tooltip -->
        <div
            v-if="tooltip.visible"
            class="map-tooltip"
            :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }"
        >
            {{ tooltip.text }}
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as d3 from 'd3'
import mapData from '../assets/mapPaths.json'

const props = defineProps({
    modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'country-click'])

const svgEl = ref(null)
const gEl = ref(null)
const mapContainer = ref(null)
let zoomBehavior = null
let currentTransform = d3.zoomIdentity

const modelValueUpper = computed(() => props.modelValue?.toUpperCase?.() || '')
const svgViewBox = '0 0 1000 600'
const { mapPaths, mapNamesZh } = mapData

/**
 * 點擊國家
 */
function onCountryClick(id) {
    emit('update:modelValue', id)
    emit('country-click', id)
}

/**
 * 聚焦到國家（動畫）
 */
function focusCountry(id) {
    const el = svgEl.value.querySelector(`#${id}`)
    if (!el) return

    const bbox = el.getBBox()

    // 基於 viewBox (1000x600) 的座標來計算
    const viewWidth = 1000
    const viewHeight = 600

    const scaleX = (viewWidth * 0.6) / bbox.width
    const scaleY = (viewHeight * 0.6) / bbox.height
    const maxScale = 10
    const targetZoom = Math.min(scaleX, scaleY, maxScale)

    // 把選中區域的中心移到 viewBox 中心 (500, 300)
    const x = viewWidth / 2 - (bbox.x + bbox.width / 2) * targetZoom
    const y = viewHeight / 2 - (bbox.y + bbox.height / 2) * targetZoom

    const targetTransform = d3.zoomIdentity.translate(x, y).scale(targetZoom)

    d3.select(svgEl.value)
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .call(zoomBehavior.transform, targetTransform)

    currentTransform = targetTransform
}

/**
 * 綁定 d3 zoom
 */
function setupZoom() {
    zoomBehavior = d3
        .zoom()
        .scaleExtent([0.5, 20])
        .on('zoom', (event) => {
            currentTransform = event.transform
            d3.select(gEl.value).attr('transform', currentTransform)
        })

    d3.select(svgEl.value).call(zoomBehavior)
}

onMounted(() => {
    setupZoom()
})

onBeforeUnmount(() => {
    d3.select(svgEl.value).on('.zoom', null)
})

watch(
    () => props.modelValue,
    (val) => {
        if (val) focusCountry(val)
    },
    { immediate: true }
)

const tooltip = ref({
    visible: false,
    x: 0,
    y: 0,
    text: '',
})

function showTooltip(event, id) {
    tooltip.value.visible = true
    tooltip.value.text = `${mapNamesZh[id]} ${id}`
    moveTooltip(event)
}

function moveTooltip(event) {
    tooltip.value.x = event.clientX + 10 // 偏移避免擋住
    tooltip.value.y = event.clientY + 10
}

function hideTooltip() {
    tooltip.value.visible = false
}
</script>

<style scoped>
.map-container {
    margin: 0 auto;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: absolute;
    left: 0;
    top: 0;

    touch-action: none;
}
.world-map {
    width: 100%;
    height: 100%;
}

.country {
    fill: #f2f3f5;
    stroke: #fff;
    stroke-width: 0.5px;
    cursor: pointer;
    transition: fill 0.2s;
}
.country:hover {
    fill: #e4e6ea;
}
.country.active {
    fill: #d0d4da;
}

.map-tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 1000;
}
</style>
