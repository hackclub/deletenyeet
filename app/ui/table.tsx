import type { Handle, RemixNode } from 'remix/component'

import { Button } from './button.tsx'
import { Container } from './container.tsx'
import { Icon } from './icon.tsx'

export interface TableColumn<T> {
  id: string
  header: string
  cell(item: T): RemixNode
  sortable?: boolean
}

export interface TableState {
  sortBy: string | null
  descending: boolean
  filter: string
}

export interface TableStateOptions {
  sortable: string[]
  defaultSortBy?: string
  defaultDescending?: boolean
  prefix?: string
}

export function readTableState(url: URL, options: TableStateOptions): TableState {
  let params = names(options.prefix)
  let sortBy = url.searchParams.get(params.sort)
  let order = url.searchParams.get(params.order)
  let valid = sortBy !== null && options.sortable.includes(sortBy)
  return {
    sortBy: valid ? sortBy : (options.defaultSortBy ?? null),
    descending: valid ? order === 'desc' : (options.defaultDescending ?? false),
    filter: (url.searchParams.get(params.filter) ?? '').trim().slice(0, 200),
  }
}

export function applyTableState<T>(
  items: T[],
  state: TableState,
  accessors: {
    filterText(item: T): string
    sortValue(item: T, columnId: string): string | number | Date | null
  },
): T[] {
  let needle = state.filter.toLowerCase()
  let filtered = needle
    ? items.filter((item) => accessors.filterText(item).toLowerCase().includes(needle))
    : [...items]
  if (state.sortBy === null) return filtered

  let sortBy = state.sortBy
  let direction = state.descending ? -1 : 1
  return filtered.sort((a, b) => {
    let left = accessors.sortValue(a, sortBy)
    let right = accessors.sortValue(b, sortBy)
    if (left === right) return 0
    if (left === null) return 1
    if (right === null) return -1
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) * direction
    }
    return (left < right ? -1 : 1) * direction
  })
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  items: T[]
  rowKey(item: T): string
  state: TableState
  url: URL
  header?: RemixNode
  totalCount?: number
  filterLabel?: string
  filterPlaceholder?: string
  prefix?: string
  empty?: RemixNode
}

export function Table<T>(handle: Handle<TableProps<T>>) {
  return () => {
    let { columns, items, rowKey, state, url, header, totalCount, prefix } = handle.props
    let params = names(prefix)
    let filterId = `${prefix ?? 'table'}-filter`
    let preserved = [...url.searchParams].filter(([key]) => key !== params.filter)

    return (
      <Container header={header} disableContentPaddings>
        <form class="table__tools" method="get" action={url.pathname} role="search">
          {preserved.map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <label class="visually-hidden" for={filterId}>
            {handle.props.filterLabel ?? 'Filter'}
          </label>
          <div class="table__filter">
            <input
              class="input"
              id={filterId}
              name={params.filter}
              type="search"
              value={state.filter}
              placeholder={handle.props.filterPlaceholder ?? 'Find'}
            />
          </div>
          <Button type="submit" iconName="search">
            Filter
          </Button>
          {state.filter ? (
            <>
              <Button variant="link" href={hrefWith(url, { [params.filter]: null })}>
                Clear
              </Button>
              <span class="table__matches">
                {items.length} {items.length === 1 ? 'match' : 'matches'}
                {totalCount !== undefined ? ` of ${totalCount}` : ''}
              </span>
            </>
          ) : null}
        </form>
        <div class="table__scroll">
          <table class="table">
            <thead>
              <tr>
                {columns.map((column) => {
                  let active = state.sortBy === column.id
                  let sort: 'ascending' | 'descending' | 'none' = active
                    ? state.descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                  return (
                    <th key={column.id} scope="col" aria-sort={column.sortable ? sort : undefined}>
                      {column.sortable ? (
                        <a
                          class="table__sort"
                          href={hrefWith(url, {
                            [params.sort]: column.id,
                            [params.order]: active && !state.descending ? 'desc' : 'asc',
                          })}
                        >
                          {column.header}
                          <Icon
                            name={active ? (state.descending ? 'caret-down' : 'caret-up') : 'sort'}
                          />
                        </a>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td class="table__empty" colSpan={columns.length}>
                    {state.filter ? 'No matches' : (handle.props.empty ?? 'Nothing here yet')}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={rowKey(item)}>
                    {columns.map((column) => (
                      <td key={column.id}>{column.cell(item)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Container>
    )
  }
}

function names(prefix?: string) {
  let p = prefix ? `${prefix}_` : ''
  return { sort: `${p}sort`, order: `${p}order`, filter: `${p}filter` }
}

function hrefWith(url: URL, changes: Record<string, string | null>) {
  let next = new URL(url)
  for (let [key, value] of Object.entries(changes)) {
    if (value === null) next.searchParams.delete(key)
    else next.searchParams.set(key, value)
  }
  return next.pathname + next.search
}
