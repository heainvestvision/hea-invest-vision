import { requireAdmin } from '@/lib/current-membre';
import { loadEngine } from '@/lib/data';
import Shell from '@/components/Shell';
import ParametresForm from '@/components/ParametresForm';

export default async function ParametresPage() {
  const membre = await requireAdmin();
  const { parametres } = await loadEngine();

  return (
    <Shell membre={membre} active="/parametres">
      <div className="card">
        <h2>Paramètres du club</h2>
        <p className="card-sub">
          Les constantes qui pilotent les calculs de l&rsquo;app — fixées une fois à la création du
          club jusqu&rsquo;ici, désormais modifiables ici.
        </p>
        <ParametresForm parametres={parametres} />
      </div>
    </Shell>
  );
}
