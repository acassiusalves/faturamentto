
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import type {AuthError} from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {HttpsError, onCall} from "firebase-functions/v2/https";
// CORRIGIDO: Quebra da linha de importação para respeitar o max-len.

initializeApp();

const db = getFirestore();
const auth = getAuth();

export const inviteUser = onCall(async (request) => {
  // 1. Authentication Check: Ensure the user is authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Você deve estar logado para convidar usuários."
    );
  }

  // 2. Admin Role Check: Verify the calling user is an admin.
  const callerUid = request.auth.uid;
  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Você precisa ser um administrador para executar esta ação."
      );
    }
  } catch (error) {
    logger.error("Erro ao verificar permissão do chamador:", error);
    throw new HttpsError("internal", "Erro ao verificar as permissões.");
  }

  const {email, role} = request.data;

  // 3. Input Validation
  if (!email || !role) {
    throw new HttpsError(
      "invalid-argument",
      "O email e a função (role) são obrigatórios."
    );
  }

  try {
    // 4. Create User in Firebase Authentication
    logger.info(`Criando usuário para o email: ${email}`);
    const userRecord = await auth.createUser({
      email,
      emailVerified: false,
      password: Math.random().toString(36).slice(-8),
      displayName: email.split("@")[0],
    });
    logger.info(`Usuário ${userRecord.uid} criado com sucesso.`);

    // 5. Set Custom Claims (for role-based access control)
    await auth.setCustomUserClaims(userRecord.uid, {role});
    logger.info(
      `Claim de função "${role}" definida para o usuário ${userRecord.uid}.`
    );

    // 6. Create User Document in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      email: email,
      role: role,
    });
    logger.info(
      `Documento do usuário criado no Firestore para ${userRecord.uid}.`
    );

    return {result: `Usuário ${email} convidado com a função ${role}.`};
  } catch (error) {
    logger.error("Falha ao criar usuário:", error);
    const authError = error as AuthError;
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Este email já está em uso por outro usuário."
      );
    }
    throw new HttpsError("internal", "Erro interno ao criar o usuário.");
  }
});
