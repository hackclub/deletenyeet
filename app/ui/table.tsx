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

interface TableState {
  sortBy: string | null
  descending: boolean
  filter: string
}

const names = (prefix?: string) => {
  let p = prefix ? `${prefix}_` : ''
  return { sort: `${p}sort`, order: `${p}order`, filter: `${p}filter` }
}

export function hrefWith(url: URL, changes: Record<string, string | null>) {
  let u = new URL(url)
  for (let [k, v] of Object.entries(changes)) {
    if (v === null) u.searchParams.delete(k)
    else u.searchParams.set(k, v)
  }
  return u.pathname + u.search
}

export function readTableState(
  url: URL,
  o: { sortable: string[]; defaultSortBy?: string; defaultDescending?: boolean; prefix?: string },
): TableState {
  let n = names(o.prefix)
  let q = url.searchParams
  let sortBy = q.get(n.sort)
  let valid = sortBy !== null && o.sortable.includes(sortBy)
  return {
    sortBy: valid ? sortBy : (o.defaultSortBy ?? null),
    descending: valid ? q.get(n.order) === 'desc' : !!o.defaultDescending,
    filter: (q.get(n.filter) ?? '').trim().slice(0, 200),
  }
}

export function applyTableState<T>(
  items: T[],
  { sortBy, descending, filter }: TableState,
  accessors: {
    filterText(item: T): string
    sortValue(item: T, columnId: string): string | number | Date | null
  },
): T[] {
  let needle = filter.toLowerCase()
  let rows = items.filter((i) => !needle || accessors.filterText(i).toLowerCase().includes(needle))
  if (sortBy === null) return rows
  return rows.sort((a, b) => {
    let l = accessors.sortValue(a, sortBy)
    let r = accessors.sortValue(b, sortBy)
    if (l === r) return 0
    if (l === null) return 1
    if (r === null) return -1
    let d =
      typeof l === 'string' && typeof r === 'string'
        ? l.localeCompare(r, undefined, { numeric: true, sensitivity: 'base' })
        : l < r
          ? -1
          : 1
    return descending ? -d : d
  })
}

export function Table<T>(
  handle: Handle<{
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
  }>,
) {
  return () => {
    let { columns, items, rowKey, state, url, header, totalCount, prefix } = handle.props
    let n = names(prefix)
    let id = `${prefix ?? 'table'}-filter`

    return (
      <Container header={header} disableContentPaddings>
        <form class="table__tools" method="get" action={url.pathname} role="search">
          {[...url.searchParams]
            .filter(([k]) => k !== n.filter)
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <label class="visually-hidden" for={id}>
            {handle.props.filterLabel ?? 'Filter'}
          </label>
          <div class="table__filter">
            <input
              class="input"
              id={id}
              name={n.filter}
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
              <Button variant="link" href={hrefWith(url, { [n.filter]: null })}>
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
                {columns.map((c) => {
                  let active = state.sortBy === c.id
                  let desc = active && state.descending
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={
                        c.sortable
                          ? active
                            ? desc
                              ? 'descending'
                              : 'ascending'
                            : 'none'
                          : undefined
                      }
                    >
                      {c.sortable ? (
                        <a
                          class="table__sort"
                          href={hrefWith(url, {
                            [n.sort]: c.id,
                            [n.order]: active && !desc ? 'desc' : 'asc',
                          })}
                        >
                          {c.header}
                          <Icon name={active ? (desc ? 'caret-down' : 'caret-up') : 'sort'} />
                        </a>
                      ) : (
                        c.header
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
                    {columns.map((c) => (
                      <td key={c.id}>{c.cell(item)}</td>
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
