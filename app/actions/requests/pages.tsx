import { Frame } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import type { PrivacyRequest, TargetPhase } from '../../data/tables.ts'
import { AutoRefresh } from '../../ui/public/auto-refresh.tsx'
import { TableLoading } from '../../ui/table-loading.tsx'
import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Badge } from '../../ui/badge.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import { FormField, Select } from '../../ui/form-field.tsx'
import { Header } from '../../ui/header.tsx'
import { KeyValuePairs } from '../../ui/key-value-pairs.tsx'
import { Modal } from '../../ui/modal.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { StatusIndicator, type StatusType } from '../../ui/status-indicator.tsx'
import { applyTableState, readTableState, Table, type TableColumn } from '../../ui/table.tsx'
import { Tabs } from '../../ui/tabs.tsx'
import { Actions, Field, Page, plural, Post, type Errors, type PageBase } from '../shared.tsx'
import type { RequestDetail, ResultView } from './data.ts'
import { ACTIVE_STATUSES, formatTime, REQUEST_STATUS, resultStatus, shortId } from './format.ts'

export interface NewRequestValues {
  type: string
  email: string
  slackId: string
  identityId: string
}

let section = (): [string, string] => ['Requests', routes.requests.index.href()]
let status = (s: { type: StatusType; label: string }) => (
  <StatusIndicator type={s.type}>{s.label}</StatusIndicator>
)
let note = (x: RemixNode, mono = true) => (
  <div class={`text-secondary text-small${mono ? ' mono' : ''}`}>{x}</div>
)
let list = (items: [string, RemixNode][]) =>
  items.length === 0 ? (
    <span class="text-secondary">-</span>
  ) : (
    <ul class="list-plain">
      {items.map(([k, x]) => (
        <li key={k}>{x}</li>
      ))}
    </ul>
  )
let grid = (head: RemixNode[], body: RemixNode) => (
  <div class="table__scroll">
    <table class="table">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  </div>
)
let deleted = (results: ResultView[]) =>
  results.flatMap((r) => Object.values(r.deleted ?? {})).reduce((a, b) => a + b, 0)

const COLUMNS: TableColumn<PrivacyRequest>[] = [
  {
    id: 'id',
    header: 'Request',
    sortable: true,
    cell: (r) => (
      <a class="mono" href={routes.requests.show.href({ id: r.id })}>
        {shortId(r.id)}
      </a>
    ),
  },
  { id: 'type', header: 'Type', sortable: true, cell: (r) => <Badge>{r.type}</Badge> },
  { id: 'status', header: 'Status', sortable: true, cell: (r) => status(REQUEST_STATUS[r.status]) },
  { id: 'source', header: 'Source', sortable: true, cell: (r) => r.source },
  { id: 'created_at', header: 'Received', sortable: true, cell: (r) => formatTime(r.created_at) },
]

export function RequestsIndexPage(
  handle: Handle<{ base: PageBase; requests?: PrivacyRequest[]; tableSrc?: string; url: URL }>,
) {
  return () => {
    let { base, requests, tableSrc, url } = handle.props
    return (
      <Page
        base={base}
        title="Requests"
        section={section()}
        refresh={requests?.some((r) => ACTIVE_STATUSES.includes(r.status)) ? 10 : undefined}
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
          {requests ? (
            <RequestsTable requests={requests} url={url} />
          ) : (
            <Frame
              name="requests-table"
              src={tableSrc!}
              fallback={<TableLoading label="requests" href={url.pathname + url.search} />}
            />
          )}
        </SpaceBetween>
      </Page>
    )
  }
}

export function RequestsTable(
  handle: Handle<{ requests: PrivacyRequest[]; url: URL; refresh?: boolean }>,
) {
  return () => {
    let { requests, url, refresh } = handle.props
    let state = readTableState(url, {
      sortable: ['id', 'type', 'status', 'source', 'created_at'],
      defaultSortBy: 'created_at',
      defaultDescending: true,
    })
    let items = applyTableState(requests, state, {
      filterText: (r) => `${r.id} ${r.type} ${REQUEST_STATUS[r.status].label} ${r.source}`,
      sortValue: (r, column) =>
        column === 'created_at'
          ? new Date(r.created_at as string).getTime()
          : String(r[column as keyof PrivacyRequest]),
    })
    return (
      <>
        <AutoRefresh
          seconds={10}
          active={Boolean(refresh && requests.some((r) => ACTIVE_STATUSES.includes(r.status)))}
        />
        <Table
          columns={COLUMNS}
          items={items}
          rowKey={(r: PrivacyRequest) => r.id}
          state={state}
          url={url}
          totalCount={requests.length}
          filterPlaceholder="Find by ID, type, or status"
          header={<Header counter={`(${requests.length})`}>All requests</Header>}
          empty="No requests yet"
        />
      </>
    )
  }
}

export function NewRequestPage(
  handle: Handle<{ base: PageBase; values: NewRequestValues; errors: Errors<NewRequestValues> }>,
) {
  return () => {
    let { base, values: v, errors: e } = handle.props
    return (
      <Page
        base={base}
        title="New request"
        section={section()}
        crumb={['New request', routes.requests.new.href()]}
      >
        <Post action={routes.requests.create.href()} csrf={base.csrfToken}>
          <SpaceBetween size="l">
            <Header variant="h1" description="Who up complaining about their data?">
              New request
            </Header>
            <Container header={<Header>Subject</Header>}>
              <SpaceBetween size="l">
                <FormField label="Request type" controlId="type">
                  <Select
                    id="type"
                    name="type"
                    value={v.type}
                    options={[
                      { value: 'delete', label: 'Delete' },
                      { value: 'export', label: 'Export' },
                    ]}
                  />
                </FormField>
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={v.email}
                  error={e.email}
                  required
                  autocomplete="off"
                />
                <Field
                  label="Slack ID - optional"
                  name="slack_id"
                  description="Helps in finding the user if email is not matched"
                  value={v.slackId}
                  error={e.slackId}
                  placeholder="U0123ABCD"
                  autocomplete="off"
                />
                <Field
                  label="HCA ID - optional"
                  name="identity_id"
                  value={v.identityId}
                  error={e.identityId}
                  placeholder="ident!D2afpe"
                  autocomplete="off"
                />
              </SpaceBetween>
            </Container>
            <Actions cancel={routes.requests.index.href()}>Create and dry run</Actions>
          </SpaceBetween>
        </Post>
      </Page>
    )
  }
}

function ResultsTable(
  handle: Handle<{ results: ResultView[]; phase: TargetPhase; type: 'delete' | 'export' }>,
) {
  return () => {
    let { results, phase, type } = handle.props
    let dry = phase === 'dry_run'
    return grid(
      [
        'Target',
        'Status',
        'Found',
        type === 'export' ? 'Records' : dry ? 'Would delete' : 'Deleted',
        'Retained',
        'Attempts',
      ],
      results.length === 0 ? (
        <tr>
          <td class="table__empty" colSpan={6}>
            {dry ? 'No targets were enabled for the dry run' : 'Not executed yet'}
          </td>
        </tr>
      ) : (
        results.map((r) => (
          <tr key={r.id}>
            <td>
              {r.targetName}
              {note(r.targetSlug)}
            </td>
            <td>
              {status(resultStatus(r.status, r.inFlight))}
              {r.errorCode ? note(r.errorCode) : null}
              {r.status === 'retrying' ? note(`next ${formatTime(r.nextAttemptAt)}`, false) : null}
            </td>
            <td>{r.found === null ? '-' : r.found ? 'Yes' : 'No'}</td>
            <td>
              {list(
                Object.entries(r.deleted ?? {})
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => [k, `${k}: ${n}`]),
              )}
            </td>
            <td>
              {list(
                (r.retained ?? [])
                  .filter((x) => x.count > 0)
                  .map((x) => [
                    x.type,
                    <>
                      {x.type}: {x.count} <span class="text-secondary">({x.reason})</span>
                    </>,
                  ]),
              )}
            </td>
            <td>{r.attempts}</td>
          </tr>
        ))
      ),
    )
  }
}

function Confirm(
  handle: Handle<{
    id: string
    header: string
    action: string
    csrf: string
    submit: RemixNode
    children: RemixNode
  }>,
) {
  return () => {
    let { id, header, action, csrf, submit, children } = handle.props
    return (
      <Modal
        id={id}
        header={header}
        footer={
          <Post action={action} csrf={csrf}>
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="link" type="button" popovertarget={id} popovertargetaction="hide">
                Cancel
              </Button>
              {submit}
            </SpaceBetween>
          </Post>
        }
      >
        {children}
      </Modal>
    )
  }
}

export function RequestShowPage(
  handle: Handle<{ base: PageBase; detail: RequestDetail; tab: string }>,
) {
  return () => {
    let { base, detail, tab } = handle.props
    let { request: r, identifiers, results, audit } = detail
    let { id } = r
    let csrf = base.csrfToken
    let s = REQUEST_STATUS[r.status]
    let active = ACTIVE_STATUSES.includes(r.status)
    let dryRun = results.filter((x) => x.phase === 'dry_run')
    let execution = results.filter((x) => x.phase === 'execute')
    let dryFailed = dryRun.filter((x) => x.status === 'failed').length
    let failed = execution.filter((x) => x.status === 'failed')
    let awaiting = r.status === 'awaiting_approval'
    let executing = tab === 'execution'
    let tabHref = (t: string) => `${routes.requests.show.href({ id })}?tab=${t}`
    let records = (verb: string) => (r.type === 'export' ? 'Records' : `Records ${verb}`)

    let alerts: RemixNode[] = [
      awaiting && dryFailed > 0 ? (
        <Alert
          type="error"
          header={`${plural(dryFailed, 'dry run')} failed`}
          action={
            <Post action={routes.requests.rerunDryRun.href({ id })} csrf={csrf}>
              <Button type="submit">Re-run failed</Button>
            </Post>
          }
        >
          Approval stays blocked until every target has answered its dry run.
        </Alert>
      ) : awaiting ? (
        <Alert type="info" header="Ready for review">
          Every target answered its dry run. Nothing has been deleted yet.
        </Alert>
      ) : null,
      r.status === 'partially_failed' ? (
        <Alert type="error" header="Some targets failed">
          {failed.map((x) => `${x.targetName} (${x.errorCode})`).join(', ')} did not complete after
          their last retry.
        </Alert>
      ) : null,
      active ? (
        <Alert type="info">
          This page refreshes every 5 seconds while the request is {s.label.toLowerCase()}.
        </Alert>
      ) : null,
    ].filter(Boolean)

    return (
      <Page
        base={base}
        title={`Request ${shortId(id)}`}
        section={section()}
        crumb={[shortId(id), routes.requests.show.href({ id })]}
        refresh={active ? 5 : undefined}
      >
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description={status(s)}
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                {['received', 'resolving', 'dry_running', 'awaiting_approval'].includes(
                  r.status,
                ) ? (
                  <Button popovertarget="reject-modal">Reject</Button>
                ) : null}
                {awaiting ? (
                  <Button variant="primary" popovertarget="approve-modal" disabled={dryFailed > 0}>
                    Approve
                  </Button>
                ) : null}
              </SpaceBetween>
            }
          >
            {r.type === 'delete' ? 'Deletion' : 'Export'} request{' '}
            <span class="mono">{shortId(id)}</span>
          </Header>

          {alerts.length > 0 ? <SpaceBetween size="s">{alerts}</SpaceBetween> : null}

          <Container header={<Header>Details</Header>}>
            <KeyValuePairs
              columns={3}
              items={[
                { label: 'Request ID', value: <span class="mono">{id}</span> },
                { label: 'Type', value: <Badge>{r.type}</Badge> },
                {
                  label: 'Source',
                  value: r.source === 'airtable' ? `Airtable ${r.source_ref}` : 'Manual',
                },
                {
                  label: 'Created by',
                  value: r.created_by ? <span class="mono">{r.created_by}</span> : 'System',
                },
                { label: 'Received', value: formatTime(r.created_at) },
                {
                  label: 'Decision',
                  value: r.decision
                    ? `${r.decision} by ${r.decided_by_type} ${r.decided_by} at ${formatTime(r.decided_at)}`
                    : '-',
                },
                { label: 'Completed', value: formatTime(r.completed_at) },
                {
                  label: 'Identifiers',
                  value: (
                    <ul class="list-plain">
                      {identifiers.map((i) => (
                        <li key={String(i.id)}>
                          <span class="text-secondary">{i.kind}</span>{' '}
                          <span class="mono">{i.hashed ? 'redacted' : i.value}</span>
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
                grid(
                  ['Time', 'Actor', 'Action', 'Detail'],
                  audit.map((a) => (
                    <tr key={String(a.id)}>
                      <td>{formatTime(a.occurred_at)}</td>
                      <td>
                        {a.actor_type}
                        {a.actor_id ? note(a.actor_id) : null}
                      </td>
                      <td class="mono">{a.action}</td>
                      <td class="mono">{JSON.stringify(a.detail)}</td>
                    </tr>
                  )),
                )
              ) : (
                <SpaceBetween size="m">
                  <KeyValuePairs
                    columns={3}
                    items={
                      executing
                        ? [
                            { label: 'Targets', value: String(execution.length) },
                            { label: records('deleted'), value: String(deleted(execution)) },
                            { label: 'Failed', value: String(failed.length) },
                          ]
                        : [
                            { label: 'Targets', value: String(dryRun.length) },
                            {
                              label: 'Found in',
                              value: String(dryRun.filter((x) => x.found).length),
                            },
                            { label: records('to delete'), value: String(deleted(dryRun)) },
                          ]
                    }
                  />
                  <ResultsTable
                    results={executing ? execution : dryRun}
                    phase={executing ? 'execute' : 'dry_run'}
                    type={r.type}
                  />
                </SpaceBetween>
              )}
            </Tabs>
          </Container>
        </SpaceBetween>

        <Confirm
          id="approve-modal"
          header={`Approve ${r.type === 'delete' ? 'deletion' : 'export'}?`}
          action={routes.requests.approve.href({ id })}
          csrf={csrf}
          submit={
            <Button variant="primary" type="submit">
              Approve and execute
            </Button>
          }
        >
          {r.type === 'delete'
            ? `This deletes ${deleted(dryRun)} records across ${dryRun.length} targets. It cannot be undone.`
            : `This asks ${dryRun.length} targets to export this person's data.`}
        </Confirm>
        <Confirm
          id="reject-modal"
          header="Reject request?"
          action={routes.requests.reject.href({ id })}
          csrf={csrf}
          submit={<Button type="submit">Reject</Button>}
        >
          Nothing will be executed. Pending dry runs are cancelled.
        </Confirm>
      </Page>
    )
  }
}
