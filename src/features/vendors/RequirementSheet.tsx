import { Badge } from '../../components/Badge';
import { ExternalLink } from '../../components/ExternalLink';
import { googleMapsSearchUrl } from '../../core/calendar';
import { formatInr } from '../../core/money';
import type { VendorBrief } from '../../core/vendors';

export interface RequirementSheetProps {
  brief: VendorBrief;
  city: string;
  headingId: string;
}

/** What to ask a vendor for, the host's own estimate, and a Google Maps search to find options. */
export function RequirementSheet({ brief, city, headingId }: RequirementSheetProps) {
  const mapsText = `Find ${brief.mapsQuery}${city ? ` near ${city}` : ''} on Google Maps`;
  return (
    <div className="card">
      <h3 id={headingId}>{brief.label}: what to ask for</h3>
      <ul>
        {brief.requirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>
      {brief.target !== null ? (
        <p className="small">
          Your estimate: <strong className="num">{formatInr(brief.target)}</strong>{' '}
          <Badge tone="neutral">assumption</Badge>
        </p>
      ) : null}
      <ExternalLink href={googleMapsSearchUrl(brief.mapsQuery, city)} label={mapsText} icon="map">
        {mapsText}
      </ExternalLink>
      <p className="small muted">
        Search results come from Google Maps. Lehar has not checked them.
      </p>
    </div>
  );
}
