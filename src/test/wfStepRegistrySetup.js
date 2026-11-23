// Vitest setup (ADM-1351): the Workflow Builder's step registry comes from the server, so the tests take it in from
// the committed fixture of the server's answer (src/config/__fixtures__/wfStepTypes.json, made from the backend's
// agent/services/workflow_graph/steps.py `catalog()`), as the builder does on load.
import fixture from '@/config/__fixtures__/wfStepTypes.json'
import { setStepRegistry } from '@/config/wfNodeDefinitions'

setStepRegistry(JSON.parse(JSON.stringify(fixture)))
