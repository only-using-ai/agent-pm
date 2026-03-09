import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Stub – replace with real user/session
const INITIAL_NAME = 'Alex Johnson'
const INITIAL_EMAIL = 'alex.johnson@example.com'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfilePage() {
  const [name, setName] = useState(INITIAL_NAME)
  const [email, setEmail] = useState(INITIAL_EMAIL)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setAvatarUrl(url)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: persist profile
    console.log({ name, email, avatarUrl: avatarUrl ?? 'default' })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your profile picture, name, and email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Profile picture</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative rounded-full ring-2 ring-border ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Avatar size="lg" className="size-20">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={name} />
                    ) : null}
                    <AvatarFallback className="text-lg">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100',
                      'flex flex-col gap-0.5 text-xs text-white'
                    )}
                  >
                    <Camera className="size-5" />
                    Change
                  </span>
                </button>
                <div className="text-sm text-muted-foreground">
                  Click the avatar to upload a new picture. JPG, PNG or GIF.
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePictureChange}
                  aria-label="Upload profile picture"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit">Save changes</Button>
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
