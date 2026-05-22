'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ACTIVITY_CATEGORY_GROUPS } from './ActivityCategoryPicker'

export default function TransactionFilters({
  fundingSources
}: {
  fundingSources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const currentSource = searchParams.get('sourceId') || 'all'
  const currentMajor = searchParams.get('categoryMajor') || 'all'
  const currentMinor = searchParams.get('categoryMinor') || 'all'

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleMajorChange = (majorValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (majorValue && majorValue !== 'all') {
      params.set('categoryMajor', majorValue)
    } else {
      params.delete('categoryMajor')
    }
    params.delete('categoryMinor') // 대분류 변경 시 중분류 초기화
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleMinorChange = (minorValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (minorValue && minorValue !== 'all') {
      params.set('categoryMinor', minorValue)
    } else {
      params.delete('categoryMinor')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // 선택된 대분류에 해당하는 중분류 목록 가져오기
  const selectedGroup = ACTIVITY_CATEGORY_GROUPS.find(g => g.major === currentMajor)
  const minorOptions = selectedGroup ? selectedGroup.items : []

  const hasAnyFilter = 
    searchParams.has('month') || 
    searchParams.has('sourceId') || 
    searchParams.has('categoryMajor') || 
    searchParams.has('categoryMinor')

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
      <div className="flex items-center space-x-2">
        <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">조회 월:</label>
        <input 
          type="month" 
          id="month-filter"
          value={currentMonth}
          onChange={(e) => updateFilters('month', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="source-filter" className="text-sm font-medium text-gray-700">재원 구분:</label>
        <select 
          id="source-filter"
          value={currentSource}
          onChange={(e) => updateFilters('sourceId', e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체보기</option>
          {fundingSources.map(fs => (
            <option key={fs.id} value={fs.id}>{fs.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="major-filter" className="text-sm font-medium text-gray-700">대분류:</label>
        <select 
          id="major-filter"
          value={currentMajor}
          onChange={(e) => handleMajorChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 대분류</option>
          {ACTIVITY_CATEGORY_GROUPS.map(g => (
            <option key={g.major} value={g.major}>{g.major}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="minor-filter" className="text-sm font-medium text-gray-700">중분류:</label>
        <select 
          id="minor-filter"
          value={currentMinor}
          onChange={(e) => handleMinorChange(e.target.value)}
          disabled={currentMajor === 'all'}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="all">전체 중분류</option>
          {minorOptions.map(minorName => (
            <option key={minorName} value={minorName}>{minorName}</option>
          ))}
        </select>
      </div>
      
      {/* Reset filters */}
      {hasAnyFilter && (
        <button 
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-800 underline ml-auto"
        >
          필터 초기화
        </button>
      )}
    </div>
  )
}
