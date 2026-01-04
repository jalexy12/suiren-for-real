import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        forceRedirectUrl="/chat"
      />
    </div>
  )
}
