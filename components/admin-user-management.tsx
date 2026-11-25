import { UserRole } from "@prisma/client";
import {
  createUserAction,
  setUserActiveAction,
  updateUserRoleAction,
} from "@/app/actions/users";
import { SubmitButton } from "@/components/submit-button";
import { plainEnumLabel } from "@/lib/labels";

const userRoles = [
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SCHEDULER,
  UserRole.TECHNICIAN,
  UserRole.READ_ONLY,
] as const;

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export function AdminUserManagement({
  users,
  currentUserId,
  savedUserId,
}: {
  users: ManagedUser[];
  currentUserId: string;
  savedUserId?: string;
}) {
  return (
    <section
      id="users"
      className="panel mb-6 p-5"
      aria-labelledby="user-management-title"
    >
      <div>
        <div className="label">Access control</div>
        <h2 id="user-management-title" className="mt-1 text-xl font-black">
          User management
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Create accounts, assign permissions, and remove access. Every change
          is recorded in the audit log.
        </p>
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer list-none p-4 font-black text-emerald-900">
          Add a user
        </summary>
        <form
          action={createUserAction}
          className="grid gap-4 border-t border-slate-200 bg-white p-4 lg:grid-cols-4"
        >
          <label>
            <span className="label">Full name</span>
            <input className="field mt-1" name="name" required minLength={2} />
          </label>
          <label>
            <span className="label">Email address</span>
            <input className="field mt-1" name="email" type="email" required />
          </label>
          <label>
            <span className="label">Initial password</span>
            <input
              className="field mt-1"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
            <span className="mt-1 block text-xs text-slate-500">
              At least 12 characters
            </span>
          </label>
          <label>
            <span className="label">Role</span>
            <select
              className="field mt-1"
              name="role"
              defaultValue={UserRole.TECHNICIAN}
            >
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {plainEnumLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end lg:col-span-4">
            <SubmitButton pendingLabel="Creating user…">
              Create user
            </SubmitButton>
          </div>
        </form>
      </details>

      <details
        className="mt-6 rounded-xl border border-slate-200"
        open={Boolean(savedUserId)}
      >
        <summary className="cursor-pointer list-none p-4 font-black text-slate-900">
          User accounts · {users.length}
          <span className="ml-2 text-sm font-bold text-slate-600">
            Open to manage roles and access
          </span>
        </summary>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((account) => (
                <tr
                  key={account.id}
                  className={
                    account.id === savedUserId
                      ? "bg-sky-50 ring-2 ring-inset ring-sky-300"
                      : !account.active
                        ? "text-slate-500"
                        : undefined
                  }
                >
                  <td className="px-3 py-4">
                    <div className="font-bold text-slate-900">
                      {account.name}
                    </div>
                    <div>{account.email}</div>
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={
                        account.active
                          ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800"
                          : "inline-flex rounded-full bg-slate-200 px-2.5 py-1 font-bold text-slate-700"
                      }
                    >
                      {account.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <form
                      action={updateUserRoleAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={account.id} />
                      <select
                        className="field max-w-56"
                        name="role"
                        defaultValue={account.role}
                      >
                        {userRoles.map((role) => (
                          <option key={role} value={role}>
                            {plainEnumLabel(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn"
                        type="submit"
                        disabled={account.id === currentUserId}
                        title={
                          account.id === currentUserId
                            ? "Another administrator must change your role"
                            : undefined
                        }
                      >
                        Save role
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="userId" value={account.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={account.active ? "false" : "true"}
                      />
                      <button
                        className="btn"
                        type="submit"
                        disabled={
                          account.id === currentUserId && account.active
                        }
                        title={
                          account.id === currentUserId && account.active
                            ? "You cannot disable your own account"
                            : undefined
                        }
                      >
                        {account.active ? "Disable" : "Reactivate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
