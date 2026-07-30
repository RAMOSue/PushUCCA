import DocumentDetailScreen from "../../../src/components/DocumentDetailScreen";

export default function SchoolIdScreen() {
  return (
    <DocumentDetailScreen
      title="School ID"
      subtitle="Upload front and back of your school ID"
      items={[
        { key: "id_front_url", label: "Front", uploadField: "id_front" },
        { key: "id_back_url", label: "Back", uploadField: "id_back" },
      ]}
    />
  );
}
