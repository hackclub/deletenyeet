import type { Handle } from 'remix/component'

import type { Staff } from '../../auth/staff.ts'
import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Badge } from '../../ui/badge.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import { FormField, Input, Select, Textarea } from '../../ui/form-field.tsx'
import { Header } from '../../ui/header.tsx'
import { KeyValuePairs } from '../../ui/key-value-pairs.tsx'
import { Modal } from '../../ui/modal.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { StaffPage } from '../../ui/staff-page.tsx'
import { StatusIndicator, type StatusType } from '../../ui/status-indicator.tsx'
import { applyTableState, readTableState, Table, type TableColumn } from '../../ui/table.tsx'
import { Tabs } from '../../ui/tabs.tsx'

interface SampleRequest {
  id: string
  kind: 'deletion' | 'export'
  status: StatusType
  statusText: string
  targets: number
  receivedAt: Date
}

const SAMPLE_REQUESTS: SampleRequest[] = [
  {
    id: 'req-0007',
    kind: 'deletion',
    status: 'pending',
    statusText: 'Awaiting approval',
    targets: 4,
    receivedAt: new Date('2026-10-09T14:12:00Z'),
  },
  {
    id: 'req-0006',
    kind: 'export',
    status: 'in-progress',
    statusText: 'Executing',
    targets: 3,
    receivedAt: new Date('2026-10-08T09:40:00Z'),
  },
  {
    id: 'req-0005',
    kind: 'deletion',
    status: 'success',
    statusText: 'Completed',
    targets: 5,
    receivedAt: new Date('2026-10-05T18:02:00Z'),
  },
  {
    id: 'req-0004',
    kind: 'deletion',
    status: 'error',
    statusText: 'Failed on 1 target',
    targets: 5,
    receivedAt: new Date('2026-10-03T11:25:00Z'),
  },
  {
    id: 'req-0003',
    kind: 'export',
    status: 'stopped',
    statusText: 'Rejected',
    targets: 2,
    receivedAt: new Date('2026-09-30T08:15:00Z'),
  },
  {
    id: 'req-0002',
    kind: 'deletion',
    status: 'warning',
    statusText: 'Identifier unresolved',
    targets: 0,
    receivedAt: new Date('2026-09-28T21:47:00Z'),
  },
  {
    id: 'req-0001',
    kind: 'export',
    status: 'info',
    statusText: 'Dry run ready',
    targets: 3,
    receivedAt: new Date('2026-09-27T16:30:00Z'),
  },
]

const COLUMNS: TableColumn<SampleRequest>[] = [
  { id: 'id', header: 'Request', sortable: true, cell: (item) => <a href="#table">{item.id}</a> },
  {
    id: 'kind',
    header: 'Type',
    sortable: true,
    cell: (item) => <Badge>{item.kind}</Badge>,
  },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    cell: (item) => <StatusIndicator type={item.status}>{item.statusText}</StatusIndicator>,
  },
  { id: 'targets', header: 'Targets', sortable: true, cell: (item) => item.targets },
  {
    id: 'receivedAt',
    header: 'Received',
    sortable: true,
    cell: (item) => (
      <time dateTime={item.receivedAt.toISOString()}>{formatDate(item.receivedAt)}</time>
    ),
  },
]

const STATUS_TYPES: StatusType[] = [
  'success',
  'error',
  'warning',
  'info',
  'stopped',
  'pending',
  'in-progress',
  'loading',
]

export function ComponentsPage(handle: Handle<{ staff: Staff; csrfToken: string; url: URL }>) {
  return () => {
    let { staff, csrfToken, url } = handle.props
    let pageHref = routes.dev.components.href()
    let tableState = readTableState(url, {
      sortable: COLUMNS.filter((column) => column.sortable).map((column) => column.id),
      defaultSortBy: 'receivedAt',
      defaultDescending: true,
    })
    let rows = applyTableState(SAMPLE_REQUESTS, tableState, {
      filterText: (item) => `${item.id} ${item.kind} ${item.statusText}`,
      sortValue: (item, columnId) =>
        columnId === 'receivedAt'
          ? item.receivedAt.getTime()
          : columnId === 'targets'
            ? item.targets
            : columnId === 'status'
              ? item.statusText
              : columnId === 'kind'
                ? item.kind
                : item.id,
    })
    let activeTab = url.searchParams.get('tab') === 'targets' ? 'targets' : 'details'
    let tabHref = (tab: string) => {
      let next = new URL(url)
      next.searchParams.set('tab', tab)
      return `${next.pathname}${next.search}#tabs`
    }

    return (
      <StaffPage
        title="Components"
        staff={staff}
        csrfToken={csrfToken}
        activeHref={pageHref}
        breadcrumbs={[
          { text: 'Privacy request hub', href: routes.home.href() },
          { text: 'Development', href: pageHref },
          { text: 'Components', href: pageHref },
        ]}
        flashes={[
          {
            id: 'flash-success',
            type: 'success',
            header: 'Request req-0005 completed',
            content: 'All 5 targets confirmed deletion.',
            dismissible: true,
          },
          {
            id: 'flash-error',
            type: 'error',
            header: 'Target failed',
            content: 'req-0004 failed on one target after 5 attempts.',
            action: <Button href="#table">View</Button>,
            dismissible: true,
          },
        ]}
      >
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="Every component in app/ui, rendered on the server. Only mapped in development."
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Button>Normal</Button>
                <Button variant="primary" popovertarget="demo-modal">
                  Open modal
                </Button>
              </SpaceBetween>
            }
          >
            Components
          </Header>

          <Container
            header={
              <Header description="Primary, normal, link, icon, and disabled.">Buttons</Header>
            }
          >
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="primary">Approve</Button>
              <Button>Run dry run</Button>
              <Button variant="link">Cancel</Button>
              <Button iconName="external" href="#buttons">
                Open in Airtable
              </Button>
              <Button variant="link" iconName="search" ariaLabel="Search" />
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button disabled>Disabled</Button>
            </SpaceBetween>
          </Container>

          <Container header={<Header>Status indicators and badges</Header>}>
            <SpaceBetween size="m">
              <SpaceBetween size="l" direction="horizontal">
                {STATUS_TYPES.map((type) => (
                  <StatusIndicator key={type} type={type}>
                    {type}
                  </StatusIndicator>
                ))}
              </SpaceBetween>
              <SpaceBetween size="xs" direction="horizontal">
                <Badge>grey</Badge>
                <Badge color="blue">blue</Badge>
                <Badge color="green">green</Badge>
                <Badge color="red">red</Badge>
              </SpaceBetween>
            </SpaceBetween>
          </Container>

          <Container header={<Header counter="(3)">Key-value pairs</Header>}>
            <KeyValuePairs
              items={[
                { label: 'Request ID', value: <code>req-0007</code> },
                { label: 'Type', value: <Badge>deletion</Badge> },
                {
                  label: 'Status',
                  value: <StatusIndicator type="pending">Awaiting approval</StatusIndicator>,
                },
                { label: 'Received', value: formatDate(SAMPLE_REQUESTS[0]!.receivedAt) },
                { label: 'Source', value: 'Airtable' },
                { label: 'Approver', value: '-' },
              ]}
            />
          </Container>

          <SpaceBetween size="s">
            <Alert type="info" header="Dry run only">
              Nothing has been sent to any target yet.
            </Alert>
            <Alert type="success">All targets confirmed.</Alert>
            <Alert type="warning" header="Identifier unresolved" action={<Button>Resolve</Button>}>
              Hack Club Auth returned no account for this identifier.
            </Alert>
            <Alert type="error" header="Target failed">
              The fake target returned 500 after 5 attempts.
            </Alert>
          </SpaceBetween>

          <Container
            header={<Header description="Plain GET form so nothing changes.">Form fields</Header>}
          >
            <form method="get" action={`${pageHref}#form`} id="form">
              <SpaceBetween size="l">
                <FormField
                  label="Requester"
                  controlId="demo-requester"
                  description="Email or Slack ID."
                >
                  <Input id="demo-requester" name="requester" placeholder="someone@example.com" />
                </FormField>
                <FormField label="Request type" controlId="demo-kind">
                  <Select
                    id="demo-kind"
                    name="kind"
                    options={[
                      { value: 'deletion', label: 'Deletion' },
                      { value: 'export', label: 'Export' },
                    ]}
                  />
                </FormField>
                <FormField
                  label="Notes"
                  controlId="demo-notes"
                  constraintText="Do not paste personal data here."
                  errorText="Notes are required."
                >
                  <Textarea id="demo-notes" name="notes" rows={3} invalid />
                </FormField>
                <SpaceBetween size="xs" direction="horizontal">
                  <Button variant="link" href={`${pageHref}#form`}>
                    Reset
                  </Button>
                  <Button variant="primary" type="submit">
                    Submit
                  </Button>
                </SpaceBetween>
              </SpaceBetween>
            </form>
          </Container>

          <div id="table">
            <Table
              columns={COLUMNS}
              items={rows}
              rowKey={(item: SampleRequest) => item.id}
              state={tableState}
              url={url}
              totalCount={SAMPLE_REQUESTS.length}
              filterPlaceholder="Find requests"
              header={
                <Header
                  counter={`(${SAMPLE_REQUESTS.length})`}
                  description="Sorting and filtering are query params, so they work without JavaScript."
                  actions={<Button variant="primary">New request</Button>}
                >
                  Requests
                </Header>
              }
            />
          </div>

          <div id="tabs">
            <Container disableContentPaddings>
              <Tabs
                label="Request sections"
                activeId={activeTab}
                tabs={[
                  { id: 'details', label: 'Details', href: tabHref('details') },
                  { id: 'targets', label: 'Targets', href: tabHref('targets') },
                ]}
              >
                {activeTab === 'details' ? (
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'Tab', value: 'Details' },
                      { label: 'Selected by', value: <code>?tab=details</code> },
                    ]}
                  />
                ) : (
                  <SpaceBetween size="xs">
                    <StatusIndicator type="success">Fake target A</StatusIndicator>
                    <StatusIndicator type="error">Fake target B</StatusIndicator>
                    <StatusIndicator type="pending">Fake target C</StatusIndicator>
                  </SpaceBetween>
                )}
              </Tabs>
            </Container>
          </div>
        </SpaceBetween>

        <Modal
          id="demo-modal"
          header="Approve deletion?"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" popovertarget="demo-modal" popovertargetaction="hide">
                Cancel
              </Button>
              <Button variant="primary" popovertarget="demo-modal" popovertargetaction="hide">
                Approve
              </Button>
            </SpaceBetween>
          }
        >
          This sends deletion jobs to 4 targets. It cannot be undone.
        </Modal>
      </StaffPage>
    )
  }
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}
