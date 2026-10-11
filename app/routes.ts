import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  health: get('/healthz'),
  jwks: get('/.well-known/jwks.json'),
  home: get('/'),
  requests: {
    index: get('/requests'),
    new: get('/requests/new'),
    create: post('/requests'),
    show: get('/requests/:id'),
    approve: post('/requests/:id/approve'),
    reject: post('/requests/:id/reject'),
    rerunDryRun: post('/requests/:id/dry-run'),
  },
  targets: {
    index: get('/targets'),
    new: get('/targets/new'),
    create: post('/targets'),
    addFakes: post('/targets/fakes'),
    edit: get('/targets/:id'),
    update: post('/targets/:id'),
  },
  auth: {
    login: get('/login'),
    startLogin: post('/login'),
    callback: get('/auth/callback'),
    logout: post('/logout'),
  },
  dev: {
    components: get('/dev/components'),
  },
})
