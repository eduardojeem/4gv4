import Link from 'next/link'

/**
 * Explicación de la verificación en dos pasos (2FA) para quien decide
 * exigirla: para qué sirve, cuándo conviene, cómo funciona, a quién alcanza y
 * qué pasa si alguien no la activa o pierde el teléfono.
 *
 * - `store`: la tienda se la exige a su dueño y sus administradores.
 * - `platform`: el superadmin se la exige a los administradores de todas las
 *   tiendas; incluye además por qué el superadmin la tiene siempre.
 */
export function TwoFactorExplainer({ scope }: { scope: 'store' | 'platform' }) {
  return (
    <details className="group rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium text-foreground">
        ¿Qué es y cómo funciona?
      </summary>
      <div className="mt-2 space-y-3">
        <section>
          <p className="font-medium text-foreground">Para qué sirve</p>
          <p>
            Protege la cuenta aunque alguien consiga la contraseña (la vio anotada, la adivinó o la robó con un
            mensaje falso). Para entrar, además de la contraseña hace falta un código que solo aparece en el
            teléfono de la persona.
          </p>
        </section>

        <section>
          <p className="font-medium text-foreground">Cuándo conviene exigirla</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Varias personas usan la misma computadora o el mismo usuario del panel.</li>
            <li>El dueño o los administradores manejan caja, finanzas, sueldos o precios.</li>
            <li>Hubo accesos que nadie reconoce o alguien dejó de trabajar en el negocio.</li>
          </ul>
        </section>

        <section>
          <p className="font-medium text-foreground">Cómo funciona</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>Instala en su teléfono una app autenticadora gratis: Google Authenticator o Microsoft Authenticator.</li>
            <li>
              En <Link href="/dashboard/profile" className="font-medium text-primary underline-offset-4 hover:underline">Perfil → Seguridad</Link>{' '}
              toca «Activar» y escanea el código QR con esa app. Se hace una sola vez.
            </li>
            <li>Desde ahí, al iniciar sesión escribe la contraseña y el código de 6 números que muestra la app. El código cambia cada 30 segundos y no necesita internet en el teléfono.</li>
          </ol>
        </section>

        <section>
          <p className="font-medium text-foreground">A quién alcanza</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {scope === 'platform'
              ? <li>Al dueño y a los administradores de <strong>todas las tiendas</strong>, aunque la tienda no la exija.</li>
              : <li>Al <strong>dueño</strong> y a los <strong>administradores</strong> de esta tienda.</li>}
            <li>No alcanza a gerentes, cajeros, vendedores ni técnicos: ellos siguen entrando solo con la contraseña (pueden activarla si quieren).</li>
            <li>Vale para el panel web y para la app del teléfono.</li>
          </ul>
        </section>

        <section>
          <p className="font-medium text-foreground">Si alguien no la activa</p>
          <p>
            Puede iniciar sesión, pero antes de ver el panel lo lleva a activarla y no puede seguir hasta hacerlo.
            En la app del teléfono le pide que la active primero desde la web. No pierde ningún dato: en cuanto la
            activa, sigue trabajando normal.
          </p>
        </section>

        <section>
          <p className="font-medium text-foreground">Si pierde o cambia el teléfono</p>
          <p>
            Tiene que pedirle al soporte de la plataforma que le reinicie la verificación; después la vuelve a
            activar con el teléfono nuevo. Conviene avisarlo antes de cambiar de teléfono.
          </p>
        </section>

        {scope === 'platform' && (
          <section>
            <p className="font-medium text-foreground">Superadmin: siempre obligatoria</p>
            <p>
              A todas las cuentas con rol de superadmin se les exige siempre, sin interruptor: el superadmin ve y
              cambia los datos de todas las tiendas, la facturación, los planes y esta configuración global. Si
              alguien se apodera de esa cuenta, afecta a toda la plataforma.
            </p>
            <p className="mt-1">
              Antes de exigirla a todas las tiendas, avisales con un comunicado: los administradores que no la
              tengan van a tener que activarla la próxima vez que entren.
            </p>
          </section>
        )}
      </div>
    </details>
  )
}
