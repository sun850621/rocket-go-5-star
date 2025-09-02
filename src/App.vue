<template>
    <WorldMap v-model="country" @country-click="countryClick" />

    <!-- 搜尋地點 autocomplete -->
    <div class="search-bar">
        <ElAutocomplete
            v-model="keyword"
            :fetch-suggestions="querySearchAsync"
            placeholder="輸入地點名稱"
            @select="handleSelect"
        >
            <template #suffix>
                <Icon icon="mdi:magnify" />
            </template>
        </ElAutocomplete>
    </div>

    <template v-if="enrichedStats.length">
        <div class="category-buttons" ref="categoryButtonsRef">
            <button
                v-for="item in enrichedStats"
                :key="item.mainCategory + item.subCategory"
                @click="onCategoryClick(item)"
                class="category-btn"
                :class="{ active: activeSubCategory === item.subCategory }"
            >
                <Icon :icon="item.icon" />
                <h4>{{ item.subCategory }}</h4>
                <p>({{ item.count }})</p>
            </button>
        </div>
    </template>

    <template v-if="activeMainCategory && activeSubCategory">
        <PoisList
            :activeMainCategory="activeMainCategory"
            :activeSubCategory="activeSubCategory"
            :activeIcon="activeIcon"
            :selectedArea="selectedArea"
        />
    </template>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { ElAutocomplete } from 'element-plus'
import WorldMap from './components/WorldMap.vue'
import PoisList from './components/PoisList.vue'
import { queryGroupBy, querySearch } from './api'
import categories from './assets/categories.json'
import mapData from './assets/mapPaths.json'

// --- 狀態管理 ---
const country = ref('')
const keyword = ref('')
const selectedArea = ref({
    area1_keyword: '',
    area2_keyword: '',
    area3_keyword: '',
    area4_keyword: '',
})
const suggestions = ref([])
const groupedStats = ref([])

const activeMainCategory = ref('')
const activeSubCategory = ref('')
const activeIcon = ref('')

const categoryButtonsRef = ref(null)

const { mapNamesZh } = mapData

/**
 * 提供給 ElAutocomplete 使用的 callback 版本查詢
 */
const querySearchAsync = async (queryString, cb) => {
    const result = await querySearch(queryString)
    cb(result)
}

/**
 * 共用函式：同時查詢相似地點與分類統計
 */
const doSearchAndGroup = async (searchTerm, filters) => {
    suggestions.value = await querySearch(searchTerm)
    groupedStats.value = await queryGroupBy(filters)

    // 捲回分類按鈕的頂端
    nextTick(() => {
        categoryButtonsRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
    })
}

/**
 * 處理點擊地圖國家事件
 */
const countryClick = async (id) => {
    keyword.value = `${mapNamesZh[id]} ${id}`
    country.value = id

    selectedArea.value = {
        area1_keyword: id,
        area2_keyword: '',
        area3_keyword: '',
        area4_keyword: '',
    }
    resetActive()

    await doSearchAndGroup(id, { area1_keyword: id })
}

/**
 * 處理 autocomplete 選擇事件
 */
const handleSelect = async (item) => {
    country.value = item.raw.original_area1
    selectedArea.value = {
        area1_keyword: item.raw.original_area1,
        area2_keyword: item.raw.original_area2,
        area3_keyword: item.raw.original_area3,
        area4_keyword: item.raw.original_area4,
    }
    resetActive()

    await doSearchAndGroup(item.raw.translated_area0, { ...selectedArea.value })
}

const categoryIconMap = new Map(
    categories.map((c) => [
        `${c.custom_main_category}_${c.custom_sub_category}`,
        c.icon,
    ])
)
const enrichedStats = computed(() => {
    const stats = groupedStats.value.map((stat) => ({
        ...stat,
        icon:
            categoryIconMap.get(`${stat.mainCategory}_${stat.subCategory}`) ||
            'mdi:help-circle-outline',
    }))

    if (stats.length === 0) return []

    const totalCount = stats.reduce((sum, s) => sum + s.count, 0)

    const allStats = {
        mainCategory: '全部',
        subCategory: '全部',
        count: totalCount,
        icon: categoryIconMap.get(`全部_全部`) || 'mdi:help-circle-outline',
    }

    return [allStats, ...stats]
})

const onCategoryClick = (item) => {
    activeMainCategory.value = item.mainCategory
    activeSubCategory.value = item.subCategory
    activeIcon.value = item.icon
}

const resetActive = () => {
    activeMainCategory.value = ''
    activeSubCategory.value = ''
    activeIcon.value = ''
}
</script>

<style lang="postcss" scoped>
.search-bar {
    @apply absolute z-50 w-full 
  px-4 pt-8 lg:px-24 lg:pt-12;
}

.category-buttons {
    @apply absolute right-0 bottom-0 z-10
  h-full overflow-scroll
  pt-28 lg:pt-40 pb-4 lg:pb-8 pr-2 lg:pr-4
  grid grid-cols-1 lg:grid-cols-2 gap-2;

    button {
        @apply w-24 h-24 flex flex-col items-center justify-center
    border border-gray-300 rounded-lg bg-white shadow
    transition-colors;
        .iconify {
            @apply text-xl text-gray-600;
        }
        h4 {
            @apply text-sm font-bold text-gray-600;
        }
        p {
            @apply text-xs text-gray-600;
        }

        &:hover {
            @apply bg-gray-50;
        }
        &.active {
            @apply border-gray-600;
        }
    }
}
</style>
