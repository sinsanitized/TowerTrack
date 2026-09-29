import Link from "next/link";
import {
  serviceResponsibilityFamilies,
  serviceResponsibilityLabel,
  type TowerServiceResponsibilities,
} from "@/lib/service-responsibility";

type TowerInformationSystem = TowerServiceResponsibilities & {
  building: {
    buildingName: string;
    streetAddress: string;
    city: string;
    state: string;
    customer: { name: string };
  };
  internalJobNumber: string;
  registrationNumber: string | null;
  NYCSystemId: string | null;
  NYSSystemId: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  towerLocation: string | null;
  tonnage: number | null;
};

export function TowerInformation({
  systemId,
  system,
  canViewSettings,
}: {
  systemId: string;
  system: TowerInformationSystem;
  canViewSettings: boolean;
}) {
  return (
    <>
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">Service responsibility</div>
            <h2 className="mt-1 font-black">Who handles each service</h2>
          </div>
          {canViewSettings && (
            <Link
              className="btn"
              href={`/systems/${systemId}?view=settings#service-responsibilities`}
            >
              Change in Settings
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          These assignments control which work appears as our action and which
          work is shown as an external dependency.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {serviceResponsibilityFamilies.map(([key, label]) => {
            const responsibility = system[key];
            const external = responsibility !== "OUR_COMPANY";
            return (
              <div
                key={key}
                className={`rounded-lg border p-3 ${
                  external
                    ? "border-purple-200 bg-purple-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div className="text-xs font-bold text-slate-600">{label}</div>
                <div className="mt-1 font-black">
                  {serviceResponsibilityLabel(responsibility)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">Facility and identifiers</div>
            <h2 className="mt-1 font-black">Tower location</h2>
          </div>
          {canViewSettings && (
            <Link
              className="btn"
              href={`/systems/${systemId}/edit?returnTo=${encodeURIComponent(`/systems/${systemId}?view=information`)}`}
            >
              Edit customer and tower information
            </Link>
          )}
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="label">Customer</dt>
            <dd className="font-bold">{system.building.customer.name}</dd>
          </div>
          <div>
            <dt className="label">Facility</dt>
            <dd className="font-bold">{system.building.buildingName}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="label">Address</dt>
            <dd className="font-bold">
              {system.building.streetAddress}, {system.building.city},{" "}
              {system.building.state}
            </dd>
          </div>
          <div>
            <dt className="label">Internal job number</dt>
            <dd className="font-bold">{system.internalJobNumber}</dd>
          </div>
          <div>
            <dt className="label">Registration number</dt>
            <dd className="font-bold">
              {system.registrationNumber || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">NYC cooling tower system ID</dt>
            <dd className="font-bold">
              {system.NYCSystemId || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">NYS cooling tower system ID</dt>
            <dd className="font-bold">
              {system.NYSSystemId || "Not recorded"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel p-5">
        <div className="label">Cooling tower information</div>
        <h2 className="mt-1 font-black">Equipment details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <dt className="label">Manufacturer</dt>
            <dd className="font-bold">
              {system.manufacturer || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">Model</dt>
            <dd className="font-bold">
              {system.modelNumber || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">Serial number</dt>
            <dd className="font-bold">
              {system.serialNumber || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">Tower location</dt>
            <dd className="font-bold">
              {system.towerLocation || "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="label">Tonnage</dt>
            <dd className="font-bold">
              {system.tonnage ? `${system.tonnage} tons` : "Not recorded"}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
