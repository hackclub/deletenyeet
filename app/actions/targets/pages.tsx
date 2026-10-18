import { Frame } from 'remix/component'
import type { Handle } from 'remix/component'

import type { Target } from '../../data/tables.ts'
import { TableLoading } from '../../ui/table-loading.tsx'
import { routes } from '../../routes.ts'
import { readEndpointConfig } from '../../targets/endpoint.ts'
import { Alert } from '../../ui/alert.tsx'
import { Badge } from '../../ui/badge.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import { Checkbox } from '../../ui/form-field.tsx'
import { Header } from '../../ui/header.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { StatusIndicator } from '../../ui/status-indicator.tsx'
import { applyTableState, readTableState, Table, type TableColumn } from '../../ui/table.tsx'
import { Actions, Field, Page, Post, type Errors, type PageBase } from '../shared.tsx'
import { TargetNameFields } from './public/target-name-fields.tsx'

export interface TargetValues {
  name: string
  slug: string
  audience: string
  url: string
  enabled: boolean
}

let section = (): [string, string] => ['Targets', routes.targets.index.href()]
let mono = (s: string | null) => <span class="mono">{s ?? '-'}</span>

const COLUMNS: TableColumn<Target>[] = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    cell: (t) => <a href={routes.targets.edit.href({ id: t.id })}>{t.name}</a>,
  },
  { id: 'slug', header: 'Slug', sortable: true, cell: (t) => mono(t.slug) },
  { id: 'type', header: 'Type', sortable: true, cell: (t) => <Badge>{t.type}</Badge> },
  { id: 'audience', header: 'Audience', sortable: true, cell: (t) => mono(t.audience) },
  { id: 'url', header: 'Endpoint', cell: (t) => mono(readEndpointConfig(t.config)?.url ?? null) },
  {
    id: 'enabled',
    header: 'State',
    sortable: true,
    cell: (t) => (
      <StatusIndicator type={t.enabled ? 'success' : 'stopped'}>
        {t.enabled ? 'Enabled' : 'Disabled'}
      </StatusIndicator>
    ),
  },
]

export function TargetsIndexPage(
  handle: Handle<{
    base: PageBase
    targets?: Target[]
    tableSrc?: string
    url: URL
    development: boolean
  }>,
) {
  return () => {
    let { base, targets, tableSrc, url, development } = handle.props
    return (
      <Page base={base} title="Targets" section={section()}>
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="Every system a request fans out to. Enabled targets get a dry run on each new request."
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                {development ? (
                  <Post action={routes.targets.addFakes.href()} csrf={base.csrfToken}>
                    <Button type="submit">Add fake targets</Button>
                  </Post>
                ) : null}
                <Button variant="primary" href={routes.targets.new.href()}>
                  Register target
                </Button>
              </SpaceBetween>
            }
          >
            Targets
          </Header>
          {targets ? (
            <TargetsTable targets={targets} url={url} />
          ) : (
            <Frame
              name="targets-table"
              src={tableSrc!}
              fallback={<TableLoading label="targets" href={url.pathname + url.search} />}
            />
          )}
        </SpaceBetween>
      </Page>
    )
  }
}

export function TargetsTable(handle: Handle<{ targets: Target[]; url: URL }>) {
  return () => {
    let { targets, url } = handle.props
    let state = readTableState(url, {
      sortable: ['name', 'slug', 'type', 'audience', 'enabled'],
      defaultSortBy: 'name',
    })
    let items = applyTableState(targets, state, {
      filterText: (t) => `${t.name} ${t.slug} ${t.type} ${t.audience ?? ''}`,
      sortValue: (t, column) => String(t[column as keyof Target] ?? ''),
    })
    return (
      <Table
        columns={COLUMNS}
        items={items}
        rowKey={(t: Target) => t.id}
        state={state}
        url={url}
        totalCount={targets.length}
        filterPlaceholder="Find targets"
        header={<Header counter={`(${targets.length})`}>Registry</Header>}
        empty="No targets registered"
      />
    )
  }
}

export function TargetFormPage(
  handle: Handle<{
    base: PageBase
    target: Target | null
    values: TargetValues
    errors: Errors<TargetValues>
  }>,
) {
  return () => {
    let { base, target: t, values: v, errors: e } = handle.props
    let title = t ? t.name : 'Register target'
    return (
      <Page
        base={base}
        title={title}
        section={section()}
        crumb={[title, t ? routes.targets.edit.href({ id: t.id }) : routes.targets.new.href()]}
      >
        <Post
          action={t ? routes.targets.update.href({ id: t.id }) : routes.targets.create.href()}
          csrf={base.csrfToken}
        >
          <SpaceBetween size="l">
            <Header
              variant="h1"
              description="Targets are the services that receive privacy requests!"
            >
              {title}
            </Header>
            <Alert type="info">
              Airtable, Slack, Loops, are currently not supported (yet). This is just for services
              that can implement the endpoints!
            </Alert>
            <Container header={<Header>Endpoint target</Header>}>
              <SpaceBetween size="l">
                <TargetNameFields
                  name={v.name}
                  slug={v.slug}
                  audience={v.audience}
                  editing={t !== null}
                  errors={e}
                />
                <Field
                  label="Base URL"
                  name="url"
                  description="The yeeter posts to <base URL>/api/privacy/delete and /export."
                  type="url"
                  value={v.url}
                  error={e.url}
                  required
                  placeholder="https://orpheus.hackclub.com"
                />
                <Checkbox id="enabled" name="enabled" checked={v.enabled}>
                  Enabled: include this target in new requests
                </Checkbox>
              </SpaceBetween>
            </Container>
            <Actions cancel={routes.targets.index.href()}>{t ? 'Save' : 'Register'}</Actions>
          </SpaceBetween>
        </Post>
      </Page>
    )
  }
}
