
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {AuthError} from "firebase-admin/auth";

initializeApp();

const db = getFirestore();
const auth = getAuth();

export const inviteUser = onCall(async (request) => {
  // 1. Authentication Check: Ensure the user is authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Você deve estar logado para convidar usuários.",
    );
  }

  // 2. Admin Role Check: Verify the calling user is an admin.
  const callerUid = request.auth.uid;
  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Você precisa ser um administrador para executar esta ação.",
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
      "O email e a função (role) são obrigatórios.",
    );
  }

  try {
    // 4. Create User in Firebase Authentication
    logger.info(`Criando usuário para o email: ${email}`);
    const userRecord = await auth.createUser({
      email,
      emailVerified: false, // User will verify their email
      password: "123456",
      displayName: email.split("@")[0], // A sensible default
    });
    logger.info(`Usuário ${userRecord.uid} criado com sucesso.`);

    // 5. Set Custom Claims (for role-based access control)
    await auth.setCustomUserClaims(userRecord.uid, {role});
    logger.info(
      `Claim de função "${role}" definida para o usuário ${userRecord.uid}.`,
    );

    // 6. Create User Document in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      email: email,
      role: role,
    });
    logger.info(
      `Documento do usuário criado no Firestore para ${userRecord.uid}.`,
    );

    // You would typically send a welcome/password reset email here.
    // For this example, we'll just return a success message.

    return {result: `Usuário ${email} convidado com a função ${role}.`};
  } catch (error) {
    logger.error("Falha ao criar usuário:", error);
    const authError = error as AuthError;
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Este email já está em uso por outro usuário.",
      );
    }
    throw new HttpsError("internal", "Erro interno ao criar o usuário.");
  }
});

// Scheduled function to record the initial stock count for the day.
export const recordInitialStock = onSchedule("every day 05:00", async () => {
  logger.info("Executando a função agendada: recordInitialStock");

  try {
    const defaultUserId = "default-user";
    const userDocRef = db.collection("users").doc(defaultUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
        logger.warn(`Usuário padrão com ID ${defaultUserId} não encontrado. Criando documento.`);
        await userDocRef.set({ placeholder: true }); // Create a placeholder document if it doesn't exist
    }

    const inventoryCol = userDocRef.collection("inventory");

    const snapshot = await inventoryCol.count().get();
    const totalStock = snapshot.data().count;

    const today = new Date();
    today.setHours(today.getHours() - 3); 
    const dateKey = today.toISOString().split("T")[0];

    const summaryDocRef = db.collection("daily-summaries").doc(dateKey);

    await summaryDocRef.set({
      date: dateKey,
      initialStock: totalStock,
      recordedAt: new Date(),
    }, { merge: true });

    logger.info(`Estoque inicial de ${totalStock} itens registrado para ${dateKey}.`);
  } catch (error) {
    logger.error("Erro ao registrar o estoque inicial:", error);
  }
});
