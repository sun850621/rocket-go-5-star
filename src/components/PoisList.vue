<template>
    <div
        class="pois-wrap"
        v-if="activeMainCategory && activeSubCategory"
        ref="poisWrapRef"
    >
        <!-- 收合狀態 -->

        <div v-if="isCollapsed" class="pois-collapsed">
            <div class="pois-header">
                <button class="collapse-btn" @click="isCollapsed = false">
                    <Icon :icon="activeIcon" class="collapsed-icon" />
                </button>
            </div>
        </div>

        <!-- 展開狀態 -->
        <div v-else class="pois-expanded">
            <div class="pois-header">
                <div class="pois-title">
                    <Icon :icon="activeIcon" />
                    <h2>{{ activeSubCategory }}</h2>
                </div>
            </div>
            <button class="collapse-btn" @click="isCollapsed = true">
                <Icon icon="mdi:chevron-left" />
            </button>

            <div class="pois-search">
                <el-input
                    v-model="poiKeyword"
                    placeholder="輸入關鍵字"
                    @input="onPoiSearch"
                />
            </div>

            <ul class="pois-list">
                <li class="pois-item" v-for="p in pois" :key="p.place_id">
                    <div class="main-wrap">
                        <h2>{{ p.main_title }}</h2>
                        <div class="review-wrap">
                            <div class="rating-star-wrap">
                                <template v-for="num in Math.floor(p.rating)">
                                    <Icon icon="material-symbols:star" />
                                </template>
                                <template
                                    v-for="num in Math.ceil(5 - p.rating)"
                                >
                                    <Icon
                                        icon="material-symbols:star-outline"
                                    />
                                </template>
                            </div>
                            {{ p.rating }} ({{ p.user_ratings_total }})
                        </div>
                        <div class="poi-info">
                            {{ p.category }}・{{ p.address }}
                        </div>
                    </div>
                    <div class="button-wrap">
                        <a
                            :href="`https://www.google.com/maps/search/${p.main_title} ${p.address}/@${p.location[1]},${p.location[0]}&hl=zh-tw&gl=TW`"
                            target="_blank"
                            class="google-map-btn"
                        >
                            在 GoogleMap 上查看
                            <Icon icon="mdi:chevron-right" />
                        </a>
                    </div>
                </li>
            </ul>

            <div class="pagination-wrap">
                <el-pagination
                    layout="prev, pager, next"
                    :page-size="pageSize"
                    :current-page="currentPage"
                    :total="total"
                    @current-change="handlePageChange"
                    size="small"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { ElInput, ElPagination } from 'element-plus'
import { queryPoiList } from '../api'
import 'element-plus/es/components/pagination/style/css'

const props = defineProps({
    activeMainCategory: String,
    activeSubCategory: String,
    activeIcon: String,
    selectedArea: Object,
})

const pois = ref([])
const poiKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const poisWrapRef = ref(null)

// ➕ 收合狀態
const isCollapsed = ref(false)

const fetchPoiList = async () => {
    if (!props.activeMainCategory || !props.activeSubCategory) return

    const from = (currentPage.value - 1) * pageSize.value

    const filters = {
        ...props.selectedArea,
    }

    if (
        !(
            props.activeMainCategory === '全部' &&
            props.activeSubCategory === '全部'
        )
    ) {
        filters.custom_main_category = props.activeMainCategory
        filters.custom_sub_category = props.activeSubCategory
    }

    const { data, totalCount } = await queryPoiList(
        filters,
        from,
        pageSize.value,
        poiKeyword.value
    )

    pois.value = Array.isArray(data) ? data : []
    total.value = totalCount

    console.log(pois.value)
}

const onPoiSearch = async () => {
    currentPage.value = 1
    await fetchPoiList()
}

const handlePageChange = async (page) => {
    currentPage.value = page
    await fetchPoiList()

    nextTick(() => {
        poisWrapRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
    })
}

// ➕ 當 category 改變時，預設展開 + 抓資料
watch(
    () => [props.activeMainCategory, props.activeSubCategory],
    async () => {
        currentPage.value = 1
        poiKeyword.value = ''
        isCollapsed.value = false
        await fetchPoiList()

        nextTick(() => {
            poisWrapRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
        })
    },
    { immediate: true }
)
</script>

<style scoped lang="postcss">
.pois-wrap {
    @apply absolute left-0 top-0 lg:top-40 z-10
    overflow-scroll bg-white
    border border-l-0 border-gray-300 shadow
    rounded-r-lg;

    @media screen and (max-width: 1023px) {
        z-index: 10000;
    }

    @media screen and (min-width: 1024px) {
        max-height: calc(100vh - 196px);
    }
}

.pois-collapsed,
.pois-expanded {
    .collapse-btn {
        @apply p-4 lg:p-4 flex justify-center items-center
        text-3xl text-gray-700 hover:text-gray-500 transition-colors;
    }
}

.pois-collapsed {
    @apply hidden lg:block;
}

.pois-expanded {
    @apply p-6 flex flex-col gap-6;

    @media screen and (max-width: 1023px) {
        width: 100%;
        height: 100%;
    }

    .collapse-btn {
        @apply absolute right-0 top-2;
    }

    .pois-header {
        @apply flex justify-between items-center;

        .pois-title {
            @apply flex gap-4 text-3xl;

            h2 {
                @apply text-xl font-bold;
            }
        }
    }

    .pois-list {
        @apply grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 text-gray-600;

        .pois-item {
            @apply w-full lg:w-80 p-3 flex flex-col gap-4 justify-between
            bg-gray-50 shadow-sm rounded;
            .main-wrap {
                @apply flex flex-col;
                h2 {
                    @apply text-lg font-bold text-gray-800;
                }
                .review-wrap {
                    @apply flex items-center justify-start gap-1 text-sm;
                    .rating-star-wrap {
                        @apply flex;
                    }
                }
                .poi-info {
                    @apply text-sm;
                }
            }

            .button-wrap {
                @apply flex;
                .google-map-btn {
                    @apply flex items-center gap-1 pl-3 pr-2 py-2
                    text-xs font-bold transition-colors
                    rounded-full bg-gray-600 hover:bg-gray-800 text-white;
                }
            }
        }
    }

    .pagination-wrap {
        @apply flex justify-center;
    }
}
</style>
