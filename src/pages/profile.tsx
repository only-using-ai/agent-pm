import { useEffect, useState, useRef } from 'react'
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
import {
  getProfile,
  updateProfile,
  uploadProfileAvatar,
  getProfileAvatarUrl,
  type Profile,
} from '@/lib/api'

function getInitials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? ''
  const b = lastName.trim()[0] ?? ''
  return (a + b).toUpperCase().slice(0, 2) || '?'
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [avatarKey, setAvatarKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getProfile()
      .then((p) => {
        if (cancelled) return
        setProfile(p)
        setFirstName(p.first_name)
        setLastName(p.last_name)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateProfile({ first_name: firstName, last_name: lastName })
      setProfile(updated)
      setSaved(true)
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }))
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    setUploading(true)
    setError(null)
    try {
      const updated = await uploadProfileAvatar(file)
      setProfile(updated)
      setAvatarKey((k) => k + 1)
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload image')
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'Profile'
  const avatarUrl = profile?.avatar_url
    ? `${getProfileAvatarUrl()}?t=${avatarKey}`
    : null

  if (loading) {
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
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    )
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
              Update your profile picture, first name, and last name.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Profile picture</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="relative rounded-full ring-2 ring-border ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <Avatar size="lg" className="size-20">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="text-lg">
                      {getInitials(firstName, lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100',
                      'flex flex-col gap-0.5 text-xs text-white'
                    )}
                  >
                    <Camera className="size-5" />
                    {uploading ? 'Uploading…' : 'Change'}
                  </span>
                </button>
                <div className="text-sm text-muted-foreground">
                  Click the avatar to upload a new picture. JPG, PNG, GIF or WebP.
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">First name</Label>
                <Input
                  id="profile-first-name"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last-name">Last name</Label>
                <Input
                  id="profile-last-name"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && (
              <span className="text-sm text-muted-foreground">Saved.</span>
            )}
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
