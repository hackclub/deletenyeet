import type { Handle, RemixNode } from 'remix/component'

import type { Staff } from '../../auth/staff.ts'
import type { PrivacyRequest, TargetPhase } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Badge } from '../../ui/badge.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import type { FlashItem } from '../../ui/flashbar.tsx'
import { FormField, Input, Select } from '../../ui/form-field.tsx'
import { Header } from '../../ui/header.tsx'
import { KeyValuePairs } from '../../ui/key-value-pairs.tsx'
import { Modal } from '../../ui/modal.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { StaffPage } from '../../ui/staff-page.tsx'
import { StatusIndicator } from '../../ui/status-indicator.tsx'
import { applyTableState, readTableState, Table, type TableColumn } from '../../ui/table.tsx'
import { Tabs } from '../../ui/tabs.tsx'
import type { RequestDetail, ResultView } from './data.ts'
import { ACTIVE_STATUSES, formatTime, REQUEST_STATUS, resultStatus, shortId } from './format.ts'

interface PageBase {
  staff: Staff
  csrfToken: string
  flashes: FlashItem[]
}

function CsrfField(handle: Handle<{ token: string }>) {
  return () => <input type="hidden" name="_csrf" value={handle.props.token} />
}

const LIST_COLUMNS: TableColumn<PrivacyRequest>[] = [
  {
    id: 'id',
    header: 'Request',
    sortable: true,
    cell: (item) => (
      <a class="mono" href={routes.requests.show.href({ id: item.id })}>
        {shortId(item.id)}
      </a>
    ),
  },
  { id: 'type', header: 'Type', sortable: true, cell: (item) => <Badge>{item.type}</Badge> },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    cell: (item) => (
      <StatusIndicator type={REQUEST_STATUS[item.status].type}>
        {REQUEST_STATUS[item.status].label}
      </StatusIndicator>
    ),
  },
  { id: 'source', header: 'Source', sortable: true, cell: (item) => item.source },
  {
    id: 'created_at',
    header: 'Received',
    sortable: true,
    cell: (item) => formatTime(item.created_at),
  },
]

export function RequestsIndexPage(
  handle: Handle<PageBase & { requests: PrivacyRequest[]; url: URL }>,
) {
  return () => {
    let { staff, csrfToken, flashes, requests, url } = handle.props
    let state = readTableState(url, {
      sortable: ['id', 'type', 'status', 'source', 'created_at'],
      defaultSortBy: 'created_at',
      defaultDescending: true,
    })
    let items = applyTableState(requests, state, {
      filterText: (item) =>
        `${item.id} ${item.type} ${REQUEST_STATUS[item.status].label} ${item.source}`,
      sortValue: (item, column) =>
        column === 'created_at'
          ? new Date(item.created_at as string).getTime()
          : String(item[column as keyof PrivacyRequest]),
    })
    let refresh = requests.some((item) => ACTIVE_STATUSES.includes(item.status)) ? 10 : undefined

    return (
      <StaffPage
        title="Requests"
        staff={staff}
        csrfToken={csrfToken}
        activeHref={routes.requests.index.href()}
        flashes={flashes}
        refreshSeconds={refresh}
      >
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="Deletion and export requests across every program."
            actions={
              <Button variant="primary" href={routes.requests.new.href()}>
                New request
              </Button>
            }
          >
            Requests
          </Header>
          <Table
            columns={LIST_COLUMNS}
            items={items}
            rowKey={(item: PrivacyRequest) => item.id}
            state={state}
            url={url}
            totalCount={requests.length}
            filterPlaceholder="Find by ID, type, or status"
            header={<Header counter={`(${requests.length})`}>All requests</Header>}
            empty="No requests yet"
          />
        </SpaceBetween>
      </StaffPage>
    )
  }
}

export interface NewRequestValues {
  type: string
  email: string
  slackId: string
  identityId: string
}

export function NewRequestPage(
  handle: Handle<
    PageBase & { values: NewRequestValues; errors: Partial<Record<keyof NewRequestValues, string>> }
  >,
) {
  return () => {
    let { staff, csrfToken, flashes, values, errors } = handle.props
    return (
      <StaffPage
        title="New request"
        staff={staff}
        csrfToken={csrfToken}
        activeHref={routes.requests.index.href()}
        flashes={flashes}
        breadcrumbs={[
          { text: 'Requests', href: routes.requests.index.href() },
          { text: 'New request', href: routes.requests.new.href() },
        ]}
      >
        <form method="post" action={routes.requests.create.href()}>
          <CsrfField token={csrfToken} />
          <SpaceBetween size="l">
            <Header
              variant="h1"
              description="Nothing is sent to any target until a dry run has been reviewed and approved."
            >
              New request
            </Header>
            <Container header={<Header>Subject</Header>}>
              <SpaceBetween size="l">
                <FormField label="Request type" controlId="type">
                  <Select
                    id="type"
                    name="type"
                    value={values.type}
                    options={[
                      { value: 'delete', label: 'Delete' },
                      { value: 'export', label: 'Export' },
                    ]}
                  />
                </FormField>
                <FormField label="Email" controlId="email" errorText={errors.email}>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={values.email}
                    required
                    invalid={Boolean(errors.email)}
                    autocomplete="off"
                  />
                </FormField>
                <FormField
                  label="Slack ID - optional"
                  controlId="slack_id"
                  description="Until Hack Club Auth lookup is wired up, add any identifiers you already know."
                  errorText={errors.slackId}
                >
                  <Input
                    id="slack_id"
                    name="slack_id"
                    value={values.slackId}
                    invalid={Boolean(errors.slackId)}
                    placeholder="U0123ABCD"
                    autocomplete="off"
                  />
                </FormField>
                <FormField
                  label="Hack Club Auth identity ID - optional"
                  controlId="identity_id"
                  errorText={errors.identityId}
                >
                  <Input
                    id="identity_id"
                    name="identity_id"
                    value={values.identityId}
                    invalid={Boolean(errors.identityId)}
                    autocomplete="off"
                  />
                </FormField>
              </SpaceBetween>
            </Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" href={routes.requests.index.href()}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Create and dry run
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </form>
      </StaffPage>
    )
  }
}

function Counts(handle: Handle<{ counts: Record<string, number> | null }>) {
  return () => {
    let entries = Object.entries(handle.props.counts ?? {}).filter(([, count]) => count > 0)
    if (entries.length === 0) return <span class="text-secondary">-</span>
    return (
      <ul class="list-plain">
        {entries.map(([key, count]) => (
          <li key={key}>
            {key}: {count}
          </li>
        ))}
      </ul>
    )
  }
}

function Retained(handle: Handle<{ retained: ResultView['retained'] }>) {
  return () => {
    let items = (handle.props.retained ?? []).filter((item) => item.count > 0)
    if (items.length === 0) return <span class="text-secondary">-</span>
    return (
      <ul class="list-plain">
        {items.map((item) => (
          <li key={item.type}>
            {item.type}: {item.count} <span class="text-secondary">({item.reason})</span>
          </li>
        ))}
      </ul>
    )
  }
}

function ResultsTable(
  handle: Handle<{ results: ResultView[]; phase: TargetPhase; type: 'delete' | 'export' }>,
) {
  return () => {
    let { results, phase, type } = handle.props
    return (
      <div class="table__scroll">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Target</th>
              <th scope="col">Status</th>
              <th scope="col">Found</th>
              <th scope="col">
                {type === 'export' ? 'Records' : phase === 'dry_run' ? 'Would delete' : 'Deleted'}
              </th>
              <th scope="col">Retained</th>
              <th scope="col">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td class="table__empty" colSpan={6}>
                  {phase === 'dry_run'
                    ? 'No targets were enabled for the dry run'
                    : 'Not executed yet'}
                </td>
              </tr>
            ) : (
              results.map((result) => {
                let status = resultStatus(result.status, result.inFlight)
                return (
                  <tr key={result.id}>
                    <td>
                      {result.targetName}
                      <div class="text-secondary text-small mono">{result.targetSlug}</div>
                    </td>
                    <td>
                      <StatusIndicator type={status.type}>{status.label}</StatusIndicator>
                      {result.errorCode ? (
                        <div class="text-secondary text-small mono">{result.errorCode}</div>
                      ) : null}
                      {result.status === 'retrying' ? (
                        <div class="text-secondary text-small">
                          next {formatTime(result.nextAttemptAt)}
                        </div>
                      ) : null}
                    </td>
                    <td>{result.found === null ? '-' : result.found ? 'Yes' : 'No'}</td>
                    <td>
                      <Counts counts={result.deleted} />
                    </td>
                    <td>
                      <Retained retained={result.retained} />
                    </td>
                    <td>{result.attempts}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    )
  }
}

function sumDeleted(results: ResultView[]): number {
  return results.reduce(
    (total, result) =>
      total + Object.values(result.deleted ?? {}).reduce((sum, count) => sum + count, 0),
    0,
  )
}

export function RequestShowPage(handle: Handle<PageBase & { detail: RequestDetail; tab: string }>) {
  return () => {
    let { staff, csrfToken, flashes, detail, tab } = handle.props
    let { request, identifiers, results, audit } = detail
    let status = REQUEST_STATUS[request.status]
    let dryRun = results.filter((result) => result.phase === 'dry_run')
    let execution = results.filter((result) => result.phase === 'execute')
    let dryRunFailures = dryRun.filter((result) => result.status === 'failed')
    let executionFailures = execution.filter((result) => result.status === 'failed')
    let awaiting = request.status === 'awaiting_approval'
    let canApprove = awaiting && dryRunFailures.length === 0
    let canReject = ['received', 'resolving', 'dry_running', 'awaiting_approval'].includes(
      request.status,
    )
    let id = request.id
    let tabHref = (next: string) => `${routes.requests.show.href({ id })}?tab=${next}`
    let decided = request.decision
      ? `${request.decision} by ${request.decided_by_type} ${request.decided_by} at ${formatTime(request.decided_at)}`
      : '-'

    let alerts: RemixNode[] = []
    if (awaiting && dryRunFailures.length > 0) {
      alerts.push(
        <Alert
          type="error"
          header={`${dryRunFailures.length} dry run${dryRunFailures.length === 1 ? '' : 's'} failed`}
          action={
            <form method="post" action={routes.requests.rerunDryRun.href({ id })}>
              <CsrfField token={csrfToken} />
              <Button type="submit">Re-run failed</Button>
            </form>
          }
        >
          Approval stays blocked until every target has answered its dry run.
        </Alert>,
      )
    } else if (awaiting) {
      alerts.push(
        <Alert type="info" header="Ready for review">
          Every target answered its dry run. Nothing has been deleted yet.
        </Alert>,
      )
    }
    if (request.status === 'partially_failed') {
      alerts.push(
        <Alert type="error" header="Some targets failed">
          {executionFailures
            .map((result) => `${result.targetName} (${result.errorCode})`)
            .join(', ')}{' '}
          did not complete after their last retry.
        </Alert>,
      )
    }
    if (ACTIVE_STATUSES.includes(request.status)) {
      alerts.push(
        <Alert type="info">
          This page refreshes every 5 seconds while the request is {status.label.toLowerCase()}.
        </Alert>,
      )
    }

    return (
      <StaffPage
        title={`Request ${shortId(id)}`}
        staff={staff}
        csrfToken={csrfToken}
        activeHref={routes.requests.index.href()}
        flashes={flashes}
        refreshSeconds={ACTIVE_STATUSES.includes(request.status) ? 5 : undefined}
        breadcrumbs={[
          { text: 'Requests', href: routes.requests.index.href() },
          { text: shortId(id), href: routes.requests.show.href({ id }) },
        ]}
      >
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description={<StatusIndicator type={status.type}>{status.label}</StatusIndicator>}
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                {canReject ? <Button popovertarget="reject-modal">Reject</Button> : null}
                {awaiting ? (
                  <Button variant="primary" popovertarget="approve-modal" disabled={!canApprove}>
                    Approve
                  </Button>
                ) : null}
              </SpaceBetween>
            }
          >
            {request.type === 'delete' ? 'Deletion' : 'Export'} request{' '}
            <span class="mono">{shortId(id)}</span>
          </Header>

          {alerts.length > 0 ? <SpaceBetween size="s">{alerts}</SpaceBetween> : null}

          <Container header={<Header>Details</Header>}>
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'Request ID', value: <span class="mono">{id}</span> },
                { label: 'Type', value: <Badge>{request.type}</Badge> },
                {
                  label: 'Source',
                  value:
                    request.source === 'airtable' ? `Airtable ${request.source_ref}` : 'Manual',
                },
                {
                  label: 'Created by',
                  value: request.created_by ? (
                    <span class="mono">{request.created_by}</span>
                  ) : (
                    'System'
                  ),
                },
                { label: 'Received', value: formatTime(request.created_at) },
                { label: 'Decision', value: decided },
                { label: 'Completed', value: formatTime(request.completed_at) },
                {
                  label: 'Identifiers',
                  value: (
                    <ul class="list-plain">
                      {identifiers.map((identifier) => (
                        <li key={String(identifier.id)}>
                          <span class="text-secondary">{identifier.kind}</span>{' '}
                          <span class="mono">
                            {identifier.hashed ? 'redacted' : identifier.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          </Container>

          <Container disableContentPaddings>
            <Tabs
              label="Request sections"
              activeId={tab}
              tabs={[
                { id: 'review', label: `Dry run (${dryRun.length})`, href: tabHref('review') },
                {
                  id: 'execution',
                  label: `Execution (${execution.length})`,
                  href: tabHref('execution'),
                },
                { id: 'audit', label: `Audit trail (${audit.length})`, href: tabHref('audit') },
              ]}
            >
              {tab === 'audit' ? (
                <div class="table__scroll">
                  <table class="table">
                    <thead>
                      <tr>
                        <th scope="col">Time</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Action</th>
                        <th scope="col">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((event) => (
                        <tr key={String(event.id)}>
                          <td>{formatTime(event.occurred_at)}</td>
                          <td>
                            {event.actor_type}
                            {event.actor_id ? (
                              <div class="mono text-secondary text-small">{event.actor_id}</div>
                            ) : null}
                          </td>
                          <td class="mono">{event.action}</td>
                          <td class="mono">{JSON.stringify(event.detail)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <SpaceBetween size="m">
                  <KeyValuePairs
                    columns={3}
                    items={
                      tab === 'execution'
                        ? [
                            { label: 'Targets', value: String(execution.length) },
                            {
                              label: request.type === 'export' ? 'Records' : 'Records deleted',
                              value: String(sumDeleted(execution)),
                            },
                            { label: 'Failed', value: String(executionFailures.length) },
                          ]
                        : [
                            { label: 'Targets', value: String(dryRun.length) },
                            {
                              label: 'Found in',
                              value: String(dryRun.filter((result) => result.found).length),
                            },
                            {
                              label: request.type === 'export' ? 'Records' : 'Records to delete',
                              value: String(sumDeleted(dryRun)),
                            },
                          ]
                    }
                  />
                  <ResultsTable
                    results={tab === 'execution' ? execution : dryRun}
                    phase={tab === 'execution' ? 'execute' : 'dry_run'}
                    type={request.type}
                  />
                </SpaceBetween>
              )}
            </Tabs>
          </Container>
        </SpaceBetween>

        <Modal
          id="approve-modal"
          header={`Approve ${request.type === 'delete' ? 'deletion' : 'export'}?`}
          footer={
            <form method="post" action={routes.requests.approve.href({ id })}>
              <CsrfField token={csrfToken} />
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  variant="link"
                  type="button"
                  popovertarget="approve-modal"
                  popovertargetaction="hide"
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Approve and execute
                </Button>
              </SpaceBetween>
            </form>
          }
        >
          {request.type === 'delete'
            ? `This deletes ${sumDeleted(dryRun)} records across ${dryRun.length} targets. It cannot be undone.`
            : `This asks ${dryRun.length} targets to export this person's data.`}
        </Modal>
        <Modal
          id="reject-modal"
          header="Reject request?"
          footer={
            <form method="post" action={routes.requests.reject.href({ id })}>
              <CsrfField token={csrfToken} />
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  variant="link"
                  type="button"
                  popovertarget="reject-modal"
                  popovertargetaction="hide"
                >
                  Cancel
                </Button>
                <Button type="submit">Reject</Button>
              </SpaceBetween>
            </form>
          }
        >
          Nothing will be executed. Pending dry runs are cancelled.
        </Modal>
      </StaffPage>
    )
  }
}
