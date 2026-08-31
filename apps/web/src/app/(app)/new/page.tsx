import Link from 'next/link';
import { Button, Label } from '@morrowlane/ui';
import { startBrandBuilder } from '@/server/actions';
import { requireSession } from '@/server/session';
import { VoiceDictateButton } from './voice';
import { SubmitButton } from '@/components/submit-button';
import { ImageUpload } from './image-upload';
import { BrandFeel } from './brand-feel';

const ACTIONS = [
  { value: 'buy', label: 'Buy' },
  { value: 'book', label: 'Book' },
  { value: 'call', label: 'Call' },
  { value: 'message', label: 'Message' },
  { value: 'visit', label: 'Visit' },
  { value: 'subscribe', label: 'Subscribe' },
  { value: 'quote', label: 'Request a quote' },
];


const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

/**
 * The Brand Builder — the "I don't have a website yet" path. A short set of the
 * highest-value questions; Morrowlane turns the answers into the first Brand Profile,
 * a real Brand Brain in the same system.
 */
export default async function BrandBuilderPage() {
  await requireSession();

  return (
    <main className="min-h-screen bg-shell px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-shell-bright">Tell Morrowlane about your business</h1>
          <p className="mt-2 text-[13px] text-shell-text">
            A few quick questions and Morrowlane builds your brand profile — no website needed. You can refine everything
            after.
          </p>
        </div>

        <form action={startBrandBuilder} className="space-y-5 rounded-2xl border border-shell-line bg-white p-6 shadow-lifted">
          <div>
            <Label htmlFor="businessName">What&apos;s your business called?</Label>
            <input id="businessName" name="businessName" required placeholder="e.g. Orca Credit" className={fieldClass} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="whatYouSell">What do you sell?</Label>
              <VoiceDictateButton targetId="whatYouSell" />
            </div>
            <textarea
              id="whatYouSell"
              name="whatYouSell"
              required
              rows={4}
              placeholder="Describe it in your own words, or paste notes. e.g. A secured card that helps people build credit with on-time reporting to all three bureaus."
              className={fieldClass}
            />
            <p className="mt-1 text-[11px] text-ink-faint">Type, paste notes, or dictate — whatever&apos;s fastest.</p>
          </div>

          <div>
            <Label htmlFor="audience">Who are you trying to reach?</Label>
            <input
              id="audience"
              name="audience"
              placeholder="e.g. Young professionals rebuilding their credit"
              className={fieldClass}
            />
          </div>

          <div>
            <Label htmlFor="desiredAction">What do you want customers to do?</Label>
            <select id="desiredAction" name="desiredAction" defaultValue="buy" className={fieldClass}>
              {ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="contactChannels">Where can customers reach you?</Label>
            <textarea
              id="contactChannels"
              name="contactChannels"
              rows={3}
              placeholder={'One per line — e.g.\n@orcacredit on Instagram\n(555) 123-4567\nhttps://book.orcacredit.com'}
              className={fieldClass}
            />
          </div>

          <div>
            <Label>Upload anything you already have <span className="font-normal text-ink-faint">(optional)</span></Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <ImageUpload name="logo" label="Logo" maxBytes={800_000} />
              <ImageUpload name="images" label="Photos / product images" multiple maxBytes={1_200_000} />
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              Images help Morrowlane match your look. Large photos are resized here, so anything from your phone works.
            </p>
          </div>

          <BrandFeel />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <SubmitButton size="lg" pendingLabel="Building your profile…" hint="Reading your answers and writing your brand profile.">
              Build my brand profile
            </SubmitButton>
            <Link href="/" className="text-[13px] text-ink-faint hover:text-ink">
              I have a website after all
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
