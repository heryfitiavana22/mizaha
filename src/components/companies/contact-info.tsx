type Contact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
};

type ContactInfoProps = {
  contact: Contact;
};

export function ContactInfo({ contact }: ContactInfoProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{contact.name}</span>
      {contact.title && (
        <span className="text-muted-foreground">· {contact.title}</span>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="text-primary hover:underline"
        >
          {contact.email}
        </a>
      )}
      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          LinkedIn ↗
        </a>
      )}
    </div>
  );
}
