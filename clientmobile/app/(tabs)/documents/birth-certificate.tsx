import DocumentDetailScreen from "../../../src/components/DocumentDetailScreen";

export default function BirthCertificateScreen() {
  return (
    <DocumentDetailScreen
      title="Birth Certificate"
      subtitle="Upload or replace your birth certificate"
      items={[{ key: "birth_certificate_url", label: "Birth Certificate", uploadField: "birth_certificate" }]}
    />
  );
}
