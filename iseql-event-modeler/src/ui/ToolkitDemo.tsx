import * as React from "react";

import { TimelineEditor } from "@/ui/components/TimelineEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";

export function ToolkitDemo() {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <h1 className="mb-4 text-xl font-semibold">ISEQL Event Modeler — UI Toolkit</h1>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <TimelineEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
