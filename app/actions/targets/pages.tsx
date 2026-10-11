import type { Handle } from 'remix/component'

import type { Staff } from '../../auth/staff.ts'
import type { Target } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { readEndpointConfig } from '../../targets/endpoint.ts'
import { Alert } from '../../ui/alert.tsx'
import { Badge } from '../../ui/badge.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import type { FlashItem } from '../../ui/flashbar.tsx'
import { Checkbox, FormField, Input } from '../../ui/form-field.tsx'
import { Header } from '../../ui/header.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { StaffPage } from '../../ui/staff-page.tsx'
import { StatusIndicator } from '../../ui/status-indicator.tsx'
import { applyTableState, readTableState, Table, type TableColumn } from '../../ui/table.tsx'

interface PageBase {
  staff: Staff
  csrfToken: string
  flashes: FlashItem[]
}

const COLUMNS: TableColumn<Target>[] = [
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    cell: (item) => <a href={routes.targets.edit.href({ id: item.id })}>{item.name}</a>,
  },
  {
    id: 'slug',
    header: 'Slug',
    sortable: true,
    cell: (item) => <span class="mono">{item.slug}</span>,
  },
  { id: 'type', header: 'Type', sortable: true, cell: (item) => <Badge>{item.type}</Badge> },
  {
    id: 'audience',
    header: 'Audience',
    sortable: true,
    cell: (item) => <span class="mono">{item.audience ?? '-'}</span>,
  },
  {
    id: 'url',
    header: 'Endpoint',
    cell: (item) => <span class="mono">{readEndpointConfig(item.config)?.url ?? '-'}</span>,
  },
  {
    id: 'enabled',
    header: 'State',
    sortable: true,
    cell: (item) =>
      item.enabled ? (
        <StatusIndicator type="success">Enabled</StatusIndicator>
      ) : (
        <StatusIndicator type="stopped">Disabled</StatusIndicator>
      ),
  },
]

export function TargetsIndexPage(
  handle: Handle<PageBase & { targets: Target[]; url: URL; development: boolean }>,
) {
  return () => {
    let { staff, csrfToken, flashes, targets, url, development } = handle.props
    let state = readTableState(url, {
      sortable: ['name', 'slug', 'type', 'audience', 'enabled'],
      defaultSortBy: 'name',
    })
    let items = applyTableState(targets, state, {
      filterText: (item) => `${item.name} ${item.slug} ${item.type} ${item.audience ?? ''}`,
      sortValue: (item, column) => String(item[column as keyof Target] ?? ''),
    })
    return (
      <StaffPage
        title="Targets"
        staff={staff}
        csrfToken={csrfToken}
        activeHref={routes.targets.index.href()}
        flashes={flashes}
      >
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="Every system a request fans out to. Enabled targets get a dry run on each new request."
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                {development ? (
                  <form method="post" action={routes.targets.addFakes.href()}>
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <Button type="submit">Add fake targets</Button>
                  </form>
                ) : null}
                <Button variant="primary" href={routes.targets.new.href()}>
                  Register target
                </Button>
              </SpaceBetween>
            }
          >
            Targets
          </Header>
          <Table
            columns={COLUMNS}
            items={items}
            rowKey={(item: Target) => item.id}
            state={state}
            url={url}
            totalCount={targets.length}
            filterPlaceholder="Find targets"
            header={<Header counter={`(${targets.length})`}>Registry</Header>}
            empty="No targets registered"
          />
        </SpaceBetween>
      </StaffPage>
    )
  }
}

export interface TargetValues {
  name: string
  slug: string
  audience: string
  url: string
  enabled: boolean
}

export function TargetFormPage(
  handle: Handle<
    PageBase & {
      target: Target | null
      values: TargetValues
      errors: Partial<Record<keyof TargetValues, string>>
    }
  >,
) {
  return () => {
    let { staff, csrfToken, flashes, target, values, errors } = handle.props
    let editing = target !== null
    let title = target ? target.name : 'Register target'
    let action = target
      ? routes.targets.update.href({ id: target.id })
      : routes.targets.create.href()
    let selfHref = target ? routes.targets.edit.href({ id: target.id }) : routes.targets.new.href()
    return (
      <StaffPage
        title={title}
        staff={staff}
        csrfToken={csrfToken}
        activeHref={routes.targets.index.href()}
        flashes={flashes}
        breadcrumbs={[
          { text: 'Targets', href: routes.targets.index.href() },
          { text: title, href: selfHref },
        ]}
      >
        <form method="post" action={action}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <SpaceBetween size="l">
            <Header
              variant="h1"
              description="Endpoint targets implement POST /api/privacy/delete and /export and verify our JWKS."
            >
              {title}
            </Header>
            <Alert type="info">
              Airtable, Slack, Loops, Hackatime, and Auth target types come later. Only endpoint
              targets can be registered for now.
            </Alert>
            <Container header={<Header>Endpoint target</Header>}>
              <SpaceBetween size="l">
                <FormField label="Name" controlId="name" errorText={errors.name}>
                  <Input
                    id="name"
                    name="name"
                    value={values.name}
                    required
                    invalid={Boolean(errors.name)}
                  />
                </FormField>
                <FormField
                  label="Slug"
                  controlId="slug"
                  description="Lowercase words joined by dashes. Used in token IDs and can't change later."
                  errorText={errors.slug}
                >
                  <Input
                    id="slug"
                    name="slug"
                    value={values.slug}
                    required
                    disabled={editing}
                    invalid={Boolean(errors.slug)}
                  />
                </FormField>
                <FormField
                  label="Audience"
                  controlId="audience"
                  description="The aud claim the program checks, e.g. summer-of-making."
                  errorText={errors.audience}
                >
                  <Input
                    id="audience"
                    name="audience"
                    value={values.audience}
                    required
                    invalid={Boolean(errors.audience)}
                  />
                </FormField>
                <FormField
                  label="Base URL"
                  controlId="url"
                  description="The hub posts to <base URL>/api/privacy/delete and /export."
                  errorText={errors.url}
                >
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    value={values.url}
                    required
                    invalid={Boolean(errors.url)}
                    placeholder="https://summer.hackclub.com"
                  />
                </FormField>
                <Checkbox id="enabled" name="enabled" checked={values.enabled}>
                  Enabled: include this target in new dry runs
                </Checkbox>
              </SpaceBetween>
            </Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" href={routes.targets.index.href()}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                {editing ? 'Save' : 'Register'}
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </form>
      </StaffPage>
    )
  }
}
