import DocumentDetailScreen from "../../../src/components/DocumentDetailScreen";

export default function ClassScheduleScreen() {
  return (
    <DocumentDetailScreen
      title="Class Schedule"
      subtitle="Upload your class schedule"
      items={[{ key: "class_schedule_url", label: "Class Schedule", uploadField: "class_schedule" }]}
    />
  );
}
