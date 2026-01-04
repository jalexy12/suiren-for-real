import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { createAppRouter } from './router'

const router = createAppRouter()

hydrateRoot(document, <StartClient router={router} />)
